angular.module('arkCRM')
    .service('ContactService', function($http) {
        const API_URL = 'http://localhost:3000';  // Remove /api since it might be included in your routes

        this.getContacts = function() {
            return $http.get(`${API_URL}/api/contacts`);  // Add /api here if needed
        };

        this.updateContact = function(contact) {
            if (!contact || !contact._id) {
                return Promise.reject(new Error('Invalid contact or missing ID'));
            }
            return $http.put(`${API_URL}/api/contacts/${contact._id}`, {
                ...contact,
                _id: contact._id  // Ensure _id is included in the body
            });
        };

        this.deleteContact = function(contactId) {
            if (!contactId) {
                return Promise.reject(new Error('Missing contact ID'));
            }
            return $http.delete(`${API_URL}/api/contacts/${contactId}`);
        };

        this.createContact = function(contact) {
            return $http.post(`${API_URL}/api/contacts`, contact);
        };

        // Add payment-related functions
        this.getPayments = function() {
            return $http.get(`${API_URL}/api/payments`);
        };

        this.recordPayment = function(payment) {
            return $http.post(`${API_URL}/api/payments`, payment);
        };

        this.getResidentPayments = function(residentId) {
            return $http.get(`${API_URL}/api/payments/resident/${residentId}`);
        };
    }); 