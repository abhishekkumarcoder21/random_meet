const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// POST /api/subscription/checkout — create stripe checkout session
router.post('/checkout', authMiddleware, async (req, res) => {
    try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const prisma = req.app.get('prisma');

        const user = await prisma.user.findUnique({ where: { id: req.userId } });

        // Create or retrieve Stripe customer
        let sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
        let customerId = sub?.stripeCustomerId;

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: { userId: user.id }
            });
            customerId = customer.id;

            if (sub) {
                await prisma.subscription.update({
                    where: { userId: user.id },
                    data: { stripeCustomerId: customerId }
                });
            } else {
                await prisma.subscription.create({
                    data: { userId: user.id, stripeCustomerId: customerId }
                });
            }
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [{
                price: process.env.STRIPE_PRICE_ID,
                quantity: 1
            }],
            mode: 'subscription',
            success_url: `${process.env.FRONTEND_URL}/lobby?upgraded=true`,
            cancel_url: `${process.env.FRONTEND_URL}/upgrade?cancelled=true`,
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error('Checkout error:', err);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

// POST /api/subscription/webhook — handle stripe webhooks
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const prisma = req.app.get('prisma');

        const sig = req.headers['stripe-signature'];
        let event;

        try {
            event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const customerId = session.customer;

                const sub = await prisma.subscription.findFirst({
                    where: { stripeCustomerId: customerId }
                });

                if (sub) {
                    await prisma.subscription.update({
                        where: { id: sub.id },
                        data: {
                            stripeSubId: session.subscription,
                            plan: 'premium',
                            status: 'active'
                        }
                    });
                    await prisma.user.update({
                        where: { id: sub.userId },
                        data: { isPremium: true }
                    });
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subData = event.data.object;
                const sub = await prisma.subscription.findFirst({
                    where: { stripeSubId: subData.id }
                });

                if (sub) {
                    await prisma.subscription.update({
                        where: { id: sub.id },
                        data: { plan: 'free', status: 'cancelled' }
                    });
                    await prisma.user.update({
                        where: { id: sub.userId },
                        data: { isPremium: false }
                    });
                }
                break;
            }
        }

        res.json({ received: true });
    } catch (err) {
        console.error('Webhook error:', err);
        res.status(500).json({ error: 'Webhook handling failed' });
    }
});

// GET /api/subscription/status — check subscription status
router.get('/status', authMiddleware, async (req, res) => {
    try {
        const prisma = req.app.get('prisma');
        const sub = await prisma.subscription.findUnique({
            where: { userId: req.userId }
        });

        res.json({
            plan: sub?.plan || 'free',
            status: sub?.status || 'active',
            isPremium: sub?.plan === 'premium'
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to check subscription' });
    }
});

module.exports = router;
