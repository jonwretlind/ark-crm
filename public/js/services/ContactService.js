async getPayments() {
    try {
        const response = await fetch('/api/payments');
        if (!response.ok) {
            throw new Error('Failed to fetch payments');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching payments:', error);
        throw error;
    }
}

async getResidentPayments(residentId) {
    try {
        const response = await fetch(`/api/payments/resident/${residentId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch resident payments');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching resident payments:', error);
        throw error;
    }
}

async recordPayment(paymentData) {
    try {
        const response = await fetch('/api/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(paymentData)
        });

        if (!response.ok) {
            throw new Error('Failed to record payment');
        }

        return await response.json();
    } catch (error) {
        console.error('Error recording payment:', error);
        throw error;
    }
} 