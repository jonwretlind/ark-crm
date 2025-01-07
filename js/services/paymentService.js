angular.module('arkCRM')
    .service('PaymentService', function($http) {
        const API_URL = '/api';  // This should match your backend API URL

        // Get all payments
        this.getPayments = function() {
            return $http.get(`${API_URL}/payments`);
        };

        // Get payments for a specific resident
        this.getResidentPayments = function(residentId) {
            return $http.get(`${API_URL}/payments/resident/${residentId}`);
        };

        // Record a new payment
        this.recordPayment = function(payment) {
            return $http.post(`${API_URL}/payments`, payment);
        };

        // Get overdue payments
        this.getOverduePayments = function() {
            return $http.get(`${API_URL}/payments/overdue`);
        };

        // Update payment
        this.updatePayment = function(paymentId, payment) {
            return $http.put(`${API_URL}/payments/${paymentId}`, payment);
        };

        // Delete payment
        this.deletePayment = function(paymentId) {
            return $http.delete(`${API_URL}/payments/${paymentId}`);
        };

        // Get payment statistics
        this.getPaymentStats = function() {
            return $http.get(`${API_URL}/payments/stats`);
        };
    }); 