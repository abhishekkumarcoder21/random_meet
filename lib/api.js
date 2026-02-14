/**
 * Production-safe API fetch wrapper
 * Handles empty responses, network errors, and HTML error pages
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function safeFetch(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;

    try {
        const res = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        // Get raw text first
        const text = await res.text();

        // Debug log for mobile (can remove after testing)
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[API] ${options.method || 'GET'} ${endpoint} → ${res.status}`, text.substring(0, 100));
        }

        // Handle empty response
        if (!text || text.trim() === '') {
            throw new Error('Empty response from server. Please try again.');
        }

        // Parse JSON safely
        let data;
        try {
            data = JSON.parse(text);
        } catch (parseError) {
            console.error('[API] Failed to parse JSON:', text);
            throw new Error('Server returned invalid response. Please refresh and try again.');
        }

        // Handle HTTP errors
        if (!res.ok) {
            const errorMessage = data?.error || data?.message || `Request failed (${res.status})`;
            throw new Error(errorMessage);
        }

        return data;

    } catch (error) {
        // Network error or fetch failed
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Cannot connect to server. Check your internet connection.');
        }

        // Re-throw with original message
        throw error;
    }
}

// Helper for authenticated requests
export async function authenticatedFetch(endpoint, options = {}) {
    const token = localStorage.getItem('rm_token');

    if (!token) {
        throw new Error('Not authenticated. Please log in again.');
    }

    return safeFetch(endpoint, {
        ...options,
        headers: {
            ...options.headers,
            Authorization: `Bearer ${token}`,
        },
    });
}
