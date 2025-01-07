(function() {
    'use strict';

    angular.module('arkCRM')
        .controller('MainController', MainController);

    MainController.$inject = ['$scope', '$mdDialog', 'ContactService', '$mdToast', 'ObjectId', '$timeout', '$rootScope'];

    function MainController($scope, $mdDialog, ContactService, $mdToast, ObjectId, $timeout, $rootScope) {
        $scope.contacts = [];
        $scope.stats = {};
        $scope.currentView = 'dashboard';
        $scope.pagination = {
            currentPage: 1,
            pageSize: 25
        };

        // Function to set current view
        $scope.setView = function(view) {
            $scope.currentView = view;
            // Reset pagination when changing views
            $scope.pagination.currentPage = 1;
            // Emit view change event
            $rootScope.$emit('viewChanged', view);
        };

        // Sort configuration
        $scope.sortConfig = {
            field: 'firstName',
            secondaryField: null,
            ascending: true
        };

        // Available sort fields
        $scope.sortFields = [
            { value: 'firstName', label: 'First Name' },
            { value: 'lastName', label: 'Last Name' },
            { value: 'organization.name', label: 'Organization' },
            { value: 'type', label: 'Type' }
        ];

        // Secondary sort fields (for name sorting within groups)
        $scope.secondarySortFields = [
            { value: null, label: 'None' },
            { value: 'lastName', label: 'Last Name' },
            { value: 'firstName', label: 'First Name' }
        ];

        // Define the preferred order of contact types
        const typeOrder = [
            'Resident',
            'ResidentPipeline',
            'PastResident',
            'DeclinedResident',
            'Mentor',
            'Sponsor',
            'Volunteer',
            'Donor',
            'Board',
            'ReferralSource',
            'Partner'
        ];

        // Function to sort contact types in preferred order
        $scope.sortedTypes = function() {
            // Filter typeOrder to only include types that exist in stats
            return typeOrder.filter(type => type in $scope.stats);
        };

        // Function to get sort order for a type
        function getTypeOrder(type) {
            return typeOrder.indexOf(type);
        }

        // Function to get sorted contacts
        $scope.getSortedContacts = function() {
            let sorted = [...$scope.contacts];
            
            sorted.sort((a, b) => {
                const valueA = getNestedValue(a, $scope.sortConfig.field);
                const valueB = getNestedValue(b, $scope.sortConfig.field);
                
                // Primary sort by type or organization
                if ($scope.sortConfig.field === 'type') {
                    const orderA = getTypeOrder(valueA);
                    const orderB = getTypeOrder(valueB);
                    const typeCompare = $scope.sortConfig.ascending ? 
                        orderA - orderB : 
                        orderB - orderA;
                    
                    // If same type and secondary sort is enabled, sort by name
                    if (typeCompare === 0 && $scope.sortConfig.secondaryField) {
                        return compareValues(
                            getNestedValue(a, $scope.sortConfig.secondaryField),
                            getNestedValue(b, $scope.sortConfig.secondaryField),
                            true  // Always ascending for secondary sort
                        );
                    }
                    return typeCompare;
                }

                // Primary sort for organization
                if ($scope.sortConfig.field === 'organization.name') {
                    const orgCompare = compareValues(valueA, valueB, $scope.sortConfig.ascending);
                    
                    // If same organization and secondary sort is enabled, sort by name
                    if (orgCompare === 0 && $scope.sortConfig.secondaryField) {
                        return compareValues(
                            getNestedValue(a, $scope.sortConfig.secondaryField),
                            getNestedValue(b, $scope.sortConfig.secondaryField),
                            true  // Always ascending for secondary sort
                        );
                    }
                    return orgCompare;
                }

                // Regular sort for other fields
                return compareValues(valueA, valueB, $scope.sortConfig.ascending);
            });
            
            return sorted;
        };

        $scope.isActiveFilter = function(type) {
            return $scope.filterType === type;
        };

        $scope.setFilterType = function(type) {
            if ($scope.filterType === type) {
                // If clicking the active filter, clear it
                $scope.filterType = '';
            } else {
                // Set the new filter
                $scope.filterType = type;
            }
            // Reset to first page when filter changes
            $scope.pagination.currentPage = 1;
        };

        $scope.getIconForType = function(type) {
            const icons = {
                'Resident': 'home',
                'ResidentPipeline': 'pending',
                'PastResident': 'history',
                'DeclinedResident': 'block',
                'Board': 'groups',
                'Donor': 'volunteer_activism',
                'Volunteer': 'favorite',
                'Mentor': 'school',
                'Sponsor': 'handshake',
                'Partner': 'business',
                'ReferralSource': 'share'
            };
            return icons[type] || 'person';
        };

        $scope.getBarStyle = function(count) {
            const maxCount = Math.max(...Object.values($scope.stats));
            const percentage = (count / maxCount) * 100;
            return {
                width: percentage + '%'
            };
        };

        function loadContacts() {
            ContactService.getContacts()
                .then(function(response) {
                    console.log('Loaded contacts:', response.data.length);
                    // Map _id to id for consistency
                    $scope.contacts = response.data.map(contact => ({
                        ...contact,
                        id: contact._id  // Use MongoDB's _id as our id
                    }));
                    calculateStats(response.data);
                })
                .catch(function(error) {
                    console.error('Error loading contacts:', error);
                    $mdToast.show(
                        $mdToast.simple()
                            .textContent('Error loading contacts')
                            .position('top right')
                            .hideDelay(3000)
                    );
                });
        }

        function calculateStats(contacts) {
            console.log('Calculating stats for contacts:', contacts.length);
            
            const uniqueTypes = [...new Set(contacts.map(c => c.type))];
            console.log('Unique types found:', uniqueTypes);
            
            $scope.stats = contacts.reduce((acc, contact) => {
                const type = contact.type;
                if (type) {
                    console.log('Found type:', type);
                    acc[type] = (acc[type] || 0) + 1;
                }
                return acc;
            }, {});
            
            console.log('Final stats:', $scope.stats);
        }

        // Function to get display label (plural form)
        $scope.getTypeLabel = function(type) {
            const labels = {
                'Resident': 'Residents',
                'ResidentPipeline': 'Pipeline Residents',
                'PastResident': 'Past Residents',
                'DeclinedResident': 'Declined Residents',
                'Board': 'Board Members',
                'Donor': 'Donors',
                'Volunteer': 'Volunteers',
                'Mentor': 'Mentors',
                'Sponsor': 'Sponsors',
                'Partner': 'Partners',
                'ReferralSource': 'Referral Sources'
            };
            return labels[type] || type;
        };

        // Function to get paginated and sorted contacts
        $scope.getPaginatedContacts = function() {
            const sorted = $scope.getSortedContacts();
            const filtered = $scope.filterType ? 
                sorted.filter(c => c.type === $scope.filterType) : 
                sorted;
            
            const start = ($scope.pagination.currentPage - 1) * $scope.pagination.pageSize;
            const end = start + $scope.pagination.pageSize;
            
            return filtered.slice(start, end);
        };

        // Function to get total pages
        $scope.getTotalPages = function() {
            const filtered = $scope.filterType ? 
                $scope.contacts.filter(c => c.type === $scope.filterType) : 
                $scope.contacts;
            return Math.ceil(filtered.length / $scope.pagination.pageSize);
        };

        // Function to change page
        $scope.setPage = function(page) {
            if (page >= 1 && page <= $scope.getTotalPages()) {
                $scope.pagination.currentPage = page;
            }
        };

        // Function to generate page numbers with ellipsis
        $scope.getPageNumbers = function() {
            const total = $scope.getTotalPages();
            const current = $scope.pagination.currentPage;
            const pages = [];
            
            if (total <= 7) {
                // Show all pages if total is 7 or less
                for (let i = 1; i <= total; i++) {
                    pages.push(i);
                }
            } else {
                // Always show first page
                pages.push(1);
                
                if (current > 3) {
                    pages.push('...');
                }
                
                // Show pages around current page
                for (let i = Math.max(2, current - 1); i <= Math.min(current + 1, total - 1); i++) {
                    pages.push(i);
                }
                
                if (current < total - 2) {
                    pages.push('...');
                }
                
                // Always show last page
                pages.push(total);
            }
            
            return pages;
        };

        // Reset pagination when filter changes
        $scope.$watch('filterType', function() {
            $scope.pagination.currentPage = 1;
        });

        // Initialize resizable panels
        angular.element(document).ready(function() {
            const container = document.querySelector('.dashboard-content');
            if (container) {  // Add null check
                const resizer = container.querySelector('.resizer');
                const leftPanel = container.querySelector('.left-panel');
                if (resizer && leftPanel) {  // Add null check
                    let isResizing = false;
                    let startX, startWidth;

                    resizer.addEventListener('mousedown', function(e) {
                        e.preventDefault();
                        isResizing = true;
                        startX = e.pageX;
                        startWidth = leftPanel.offsetWidth;
                        resizer.classList.add('resizing');
                        document.body.style.cursor = 'col-resize';
                    });

                    document.addEventListener('mousemove', function(e) {
                        if (!isResizing) return;

                        const diff = e.pageX - startX;
                        const newWidth = startWidth + diff;
                        const containerWidth = container.offsetWidth;

                        // Ensure minimum widths
                        if (newWidth >= 300 && newWidth <= containerWidth - 400) {
                            container.style.gridTemplateColumns = `${newWidth}px 1fr`;
                        }
                    });

                    document.addEventListener('mouseup', function() {
                        isResizing = false;
                        resizer.classList.remove('resizing');
                        document.body.style.cursor = '';
                    });
                }
            }
        });

        // Function to toggle sort order
        $scope.toggleSortOrder = function() {
            $scope.sortConfig.ascending = !$scope.sortConfig.ascending;
            $scope.updateSort();
        };

        // Function to update sort
        $scope.updateSort = function() {
            $scope.pagination.currentPage = 1;
        };

        // Function to get value from nested object path
        function getNestedValue(obj, path) {
            return path.split('.').reduce((current, key) => 
                current ? current[key] : undefined, obj);
        }

        // Helper function for comparing values
        function compareValues(valueA, valueB, ascending) {
            // Convert null/undefined to empty string for consistent sorting
            valueA = valueA || '';
            valueB = valueB || '';
 
            // Convert to strings and do case-insensitive comparison
            const strA = String(valueA).toLowerCase();
            const strB = String(valueB).toLowerCase();
 
            const comparison = strA < strB ? -1 : (strA > strB ? 1 : 0);
            return ascending ? comparison : -comparison;
        }

        // Function to show contact details modal
        $scope.showContactDetails = function(contact) {
            console.log('Opening modal for contact:', contact);
            $mdDialog.show({
                templateUrl: 'contact-details-modal.html',
                controller: ContactDetailsController,
                locals: {
                    contact: {
                        ...angular.copy(contact),
                        id: contact.id
                    },
                    $rootScope: $scope
                },
                clickOutsideToClose: true
            }).then(function(result) {
                if (result && result.action === 'save') {
                    // Update the contact in the list
                    Object.assign(contact, result.contact);
                    // You might want to refresh your contact list here
                } else if (result && result.action === 'delete') {
                    // Handle deletion
                    $scope.contacts = $scope.contacts.filter(c => c.id !== contact.id);
                }
            });
        };

        // Contact Details Modal Controller
        function ContactDetailsController($scope, $mdDialog, $mdToast, ContactService, contact) {
            $scope.contact = contact;
            $scope.isEditing = false;
            $scope.editableContact = null;
            $scope.showingPayments = false;
            $scope.payments = [];
            
            // Add discharge reasons to the scope
            $scope.dischargeReasons = [
                'Relapse',
                'Discharged Home',
                'Dismissed for Cause',
                'Dismissed for Non-Payment'
            ];

            // Function to view payment details
            $scope.viewPaymentDetails = function(contact) {
                $scope.showingPayments = true;
                
                // Load payments for this resident
                ContactService.getPayments()
                    .then(function(response) {
                        $scope.payments = response.data
                            .filter(payment => String(payment.residentId) === String(contact._id))
                            .sort((a, b) => new Date(b.date) - new Date(a.date));
                            
                        // Calculate summary information
                        $scope.currentMonthPayment = getCurrentMonthPayment();
                        $scope.lastPayment = $scope.payments[0] || null;
                        $scope.programFee = contact.residencyDetails?.programFee || 850;
                        $scope.balance = calculateBalance();
                        $scope.nextPaymentDue = calculateNextPaymentDue();
                        $scope.paymentStatus = calculatePaymentStatus();
                    })
                    .catch(function(error) {
                        console.error('Error loading payments:', error);
                        $mdToast.show(
                            $mdToast.simple()
                                .textContent('Error loading payment history')
                                .position('top right')
                                .hideDelay(3000)
                        );
                    });
            };

            // Helper function to get current month payment
            function getCurrentMonthPayment() {
                const today = new Date();
                const currentMonth = today.getMonth();
                const currentYear = today.getFullYear();
                
                return $scope.payments.find(payment => {
                    const paymentDate = new Date(payment.date);
                    return paymentDate.getMonth() === currentMonth &&
                           paymentDate.getFullYear() === currentYear;
                });
            }

            // Helper function to calculate balance
            function calculateBalance() {
                if ($scope.currentMonthPayment) {
                    return $scope.currentMonthPayment.balance;
                } else if ($scope.lastPayment) {
                    return $scope.lastPayment.balance + $scope.programFee;
                }
                return $scope.programFee;
            }

            // Helper function to calculate next payment due
            function calculateNextPaymentDue() {
                const today = new Date();
                if ($scope.currentMonthPayment) {
                    return new Date(today.getFullYear(), today.getMonth() + 1, 5);
                }
                return new Date(today.getFullYear(), today.getMonth(), 5);
            }

            // Helper function to calculate payment status
            function calculatePaymentStatus() {
                const today = new Date();
                const dueDate = new Date(today.getFullYear(), today.getMonth(), 5);
                
                if ($scope.currentMonthPayment) {
                    return 'On Time';
                }
                
                const daysLate = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
                if (daysLate <= 0) return 'On Time';
                if (daysLate <= 30) return 'Late';
                return '>30 Days Late';
            }

            // Function to return to contact details
            $scope.backToDetails = function() {
                $scope.showingPayments = false;
            };

            // Function to check if fees are late (more than 15 days)
            $scope.isFeesLate = function(paidUntilDate) {
                if (!paidUntilDate) return false;
                const paidUntil = new Date(paidUntilDate);
                const today = new Date();
                const diffTime = today - paidUntil;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays > 15;
            };

            // Function to check if fees are critically late (more than 30 days)
            $scope.isFeesCritical = function(paidUntilDate) {
                if (!paidUntilDate) return false;
                const paidUntil = new Date(paidUntilDate);
                const today = new Date();
                const diffTime = today - paidUntil;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays > 30;
            };

            // Function to get number of days late
            $scope.getDaysLate = function(paidUntilDate) {
                if (!paidUntilDate) return 0;
                const paidUntil = new Date(paidUntilDate);
                const today = new Date();
                const diffTime = today - paidUntil;
                return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            };

            $scope.edit = function() {
                $scope.isEditing = true;
                // Create a deep copy of the contact for editing
                $scope.editableContact = angular.copy($scope.contact);
                
                // Ensure all necessary objects exist for editing
                // Check if it's any type of resident
                if (['Resident', 'ResidentPipeline', 'PastResident', 'DeclinedResident'].includes($scope.contact.type)) {
                    $scope.editableContact.residencyDetails = $scope.editableContact.residencyDetails || {};
                    $scope.editableContact.emergencyContact = $scope.editableContact.emergencyContact || {};
                    
                    // Convert date strings to Date objects for date inputs
                    if ($scope.editableContact.residencyDetails.moveInDate) {
                        $scope.editableContact.residencyDetails.moveInDate = new Date($scope.editableContact.residencyDetails.moveInDate);
                    }
                    if ($scope.editableContact.residencyDetails.programFeesPaidUntil) {
                        $scope.editableContact.residencyDetails.programFeesPaidUntil = new Date($scope.editableContact.residencyDetails.programFeesPaidUntil);
                    }
                }
                
                // Ensure other objects exist
                $scope.editableContact.organization = $scope.editableContact.organization || {};
                $scope.editableContact.contact = $scope.editableContact.contact || {};
                
                console.log('Editing contact:', $scope.editableContact);
            };

            $scope.save = async function() {
                try {
                    console.log('Saving contact:', $scope.editableContact);
                    if (!$scope.editableContact._id) {
                        throw new Error('Contact ID is missing');
                    }

                    // Save to database first
                    await ContactService.updateContact($scope.editableContact);
                    
                    // Update the contact with edited values
                    Object.assign($scope.contact, $scope.editableContact);
                    
                    // Show success message
                    $mdToast.show(
                        $mdToast.simple()
                            .textContent('Changes saved successfully')
                            .position('top right')
                            .hideDelay(3000)
                    );
                    
                    // Exit edit mode and close modal
                    $scope.isEditing = false;
                    $mdDialog.hide({ action: 'save', contact: $scope.contact });
                } catch (error) {
                    console.error('Error saving contact:', error);
                    // Show error message
                    $mdToast.show(
                        $mdToast.simple()
                            .textContent(error.message || 'Error saving changes')
                            .position('top right')
                            .hideDelay(3000)
                    );
                }
            };

            $scope.cancelEdit = function() {
                $scope.isEditing = false;
                $scope.editableContact = null;
            };

            $scope.delete = function() {
                $mdDialog.hide({ action: 'delete', contact: $scope.contact });
            };

            $scope.cancel = function() {
                $mdDialog.cancel();
            };
        }

        // Add listener in parent controller
        $scope.$on('contactUpdated', function(event, data) {
            // Find and update the contact in the list
            const index = $scope.contacts.findIndex(c => c.id === data.contact.id);
            if (index !== -1) {
                Object.assign($scope.contacts[index], data.contact);
            }
        });

        $scope.createNewContact = function() {
            $mdDialog.show({
                templateUrl: 'new-contact-modal.html',
                controller: NewContactController,
                clickOutsideToClose: false,
                escapeToClose: true,
                fullscreen: true,
                multiple: true,
                parent: angular.element(document.body)
            }).then(function(result) {
                if (result) {
                    // Refresh the contacts list
                    loadContacts();
                }
            }).catch(function(err) {
                // Handle dialog cancel/close
                if (err !== undefined) {
                    console.error('Dialog error:', err);
                }
            });
        };

        function NewContactController($scope, $mdDialog, ContactService, $mdToast) {
            // Define available types
            $scope.contactTypes = [
                { value: 'Resident', label: 'Current Resident' },
                { value: 'ResidentPipeline', label: 'Pipeline Resident' },
                { value: 'PastResident', label: 'Past Resident' },
                { value: 'DeclinedResident', label: 'Declined Resident' },
                { value: 'Mentor', label: 'Mentor' },
                { value: 'Sponsor', label: 'Sponsor' },
                { value: 'Volunteer', label: 'Volunteer' },
                { value: 'Donor', label: 'Donor' },
                { value: 'Board', label: 'Board Member' },
                { value: 'ReferralSource', label: 'Referral Source' },
                { value: 'Partner', label: 'Partner' }
            ];

            // Initialize new contact
            $scope.newContact = {
                firstName: '',
                lastName: '',
                type: '',
                status: 'Active',
                contact: {
                    email: '',
                    phone: null,
                    address: null
                },
                organization: {
                    name: null,
                    role: null
                },
                residencyDetails: null,
                emergencyContact: null,
                volunteerDetails: {
                    skills: []
                },
                donorDetails: {
                    donations: []
                },
                notes: '',
                createdAt: new Date(),
                tags: []
            };

            // Handle type change
            $scope.handleTypeChange = function() {
                if (!$scope.newContact.type) return;
                
                console.log('Type changed to:', $scope.newContact.type);
                
                // Reset all type-specific fields to empty objects with null values
                $scope.newContact.organization = {
                    name: null,
                    role: null
                };
                $scope.newContact.residencyDetails = null;
                $scope.newContact.emergencyContact = null;
                $scope.newContact.volunteerDetails = {
                    skills: []
                };
                $scope.newContact.donorDetails = {
                    donations: []
                };
                
                // Handle resident-specific fields
                if ($scope.newContact.type === 'Resident') {
                    $scope.newContact.residencyDetails = {
                        moveInDate: new Date(),
                        programFeesPaidUntil: new Date(),
                        programBalance: 0,
                        programFee: 850,
                        discipler: '',
                        comments: '',
                        dischargeReason: null
                    };
                    $scope.newContact.emergencyContact = {
                        name: '',
                        relationship: '',
                        phone: ''
                    };
                } else if ($scope.newContact.type === 'ResidentPipeline') {
                    $scope.newContact.residencyDetails = {
                        moveInDate: null,
                        programFeesPaidUntil: null,
                        programBalance: 0,
                        programFee: 850,
                        discipler: '',
                        comments: '',
                        dischargeReason: null
                    };
                    $scope.newContact.emergencyContact = {
                        name: '',
                        relationship: '',
                        phone: ''
                    };
                } else if ($scope.newContact.type === 'PastResident') {
                    $scope.newContact.residencyDetails = {
                        moveInDate: null,
                        programFeesPaidUntil: null,
                        programBalance: 0,
                        programFee: 0,
                        discipler: '',
                        comments: '',
                        dischargeReason: null
                    };
                    $scope.newContact.emergencyContact = {
                        name: '',
                        relationship: '',
                        phone: ''
                    };
                }

                // Handle organization fields
                if (['Donor', 'ReferralSource', 'Partner'].includes($scope.newContact.type)) {
                    $scope.newContact.organization = {
                        name: '',
                        role: ''
                    };
                }

                // Handle volunteer fields
                if ($scope.newContact.type === 'Volunteer') {
                    $scope.newContact.volunteerDetails = {
                        skills: []
                    };
                }

                // Handle donor fields
                if ($scope.newContact.type === 'Donor') {
                    $scope.newContact.donorDetails = {
                        donations: []
                    };
                }
            };

            // Available discharge reasons
            $scope.dischargeReasons = [
                'Relapse',
                'Discharged Home',
                'Dismissed for Cause',
                'Dismissed for Non-Payment'
            ];

            // Watch for status changes on current residents
            $scope.$watch('newContact.status', function(newStatus, oldStatus) {
                if ($scope.newContact.type === 'Resident' && newStatus === 'Inactive' && oldStatus === 'Active') {
                    $scope.newContact.type = 'PastResident';
                    // Reset payment-related fields
                    $scope.newContact.residencyDetails.programFeesPaidUntil = null;
                    $scope.newContact.residencyDetails.programBalance = 0;
                    $scope.newContact.residencyDetails.programFee = 0;
                    $mdToast.show(
                        $mdToast.simple()
                            .textContent('Contact moved to Past Residents')
                            .position('top right')
                            .hideDelay(3000)
                    );
                }
            });

            // Convert pipeline to resident
            $scope.convertToResident = function() {
                $scope.newContact.type = 'Resident';
                $scope.newContact.status = 'Active';
                $scope.newContact.residencyDetails = {
                    ...$scope.newContact.residencyDetails,
                    moveInDate: new Date(),
                    programFeesPaidUntil: new Date(),
                    programFee: 850 // Default program fee
                };
                $mdToast.show(
                    $mdToast.simple()
                        .textContent('Pipeline contact converted to Resident')
                        .position('top right')
                        .hideDelay(3000)
                );
            };

            // Mark pipeline as declined
            $scope.markAsDeclined = function() {
                $scope.newContact.type = 'DeclinedResident';
                $scope.newContact.status = 'Inactive';
                $mdToast.show(
                    $mdToast.simple()
                        .textContent('Pipeline contact marked as Declined')
                        .position('top right')
                        .hideDelay(3000)
                );
            };

            $scope.cancel = function() {
                $mdDialog.cancel();
            };

            $scope.save = function() {
                if (!$scope.isValid()) {
                    $mdToast.show(
                        $mdToast.simple()
                            .textContent('Please fill in all required fields')
                            .position('top right')
                            .hideDelay(3000)
                    );
                    return;
                }

                ContactService.createContact($scope.newContact)
                    .then(function(response) {
                        $mdToast.show(
                            $mdToast.simple()
                                .textContent('Contact created successfully')
                                .position('top right')
                                .hideDelay(3000)
                        );
                        $mdDialog.hide(response.data);
                    })
                    .catch(function(error) {
                        console.error('Error creating contact:', error);
                        $mdToast.show(
                            $mdToast.simple()
                                .textContent('Error creating contact')
                                .position('top right')
                                .hideDelay(3000)
                        );
                    });
            };

            // Validation function
            $scope.isValid = function() {
                return $scope.newContact.firstName && 
                       $scope.newContact.lastName && 
                       $scope.newContact.type && 
                       $scope.newContact.contact.email;
            };
        }

        // Ledger functionality
        $scope.ledgerView = 'all';
        $scope.payments = [];
        $scope.selectedResident = null;
        $scope.residents = [];

        // Function to update residents list
        function updateResidentsList() {
            console.log('Updating residents list...');
            $scope.residents = $scope.contacts
                .filter(c => c.type === 'Resident')
                .map(resident => {
                    console.log('Mapping resident:', resident);
                    return {
                        _id: resident._id,
                        firstName: resident.firstName,
                        lastName: resident.lastName
                    };
                });
            console.log('Updated residents list:', $scope.residents);
        }

        // Watch for contacts changes to update residents list
        $scope.$watch('contacts', function(newContacts) {
            if (newContacts) {
                updateResidentsList();
            }
        });

        // Watch for ledger view changes
        $scope.$watch('ledgerView', function(newView, oldView) {
            console.log('Ledger view changed from', oldView, 'to:', newView);
            if (newView === 'resident') {
                console.log('Switching to resident view...');
                updateResidentsList();
                // Reset selected resident when switching to resident view
                $scope.selectedResident = null;
                $scope.residentPayments = [];
            }
        });

        // Handle resident change
        $scope.handleResidentChange = function(selectedResident) {
            console.log('handleResidentChange called with resident:', selectedResident);
            
            if (!selectedResident) {
                $scope.selectedResident = null;
                $scope.residentPayments = [];
                return;
            }

            // Get resident's full details from contacts
            const resident = $scope.contacts.find(c => String(c._id) === String(selectedResident._id));
            console.log('Found resident details:', resident);

            // Update selected resident with full details
            $scope.selectedResident = {
                ...selectedResident,
                residencyDetails: resident?.residencyDetails || {}
            };

            // Get resident's payments
            $scope.residentPayments = $scope.payments
                .filter(payment => String(payment.residentId) === String(selectedResident._id))
                .sort((a, b) => new Date(b.date) - new Date(a.date));

            console.log('Found payments for resident:', $scope.residentPayments);
        };

        // Calculate overdue payments
        function calculateOverduePayments() {
            const today = new Date();
            $scope.overduePayments = $scope.contacts
                .filter(c => c.type === 'Resident')
                .map(resident => {
                    const payments = $scope.payments
                        .filter(p => p.residentId === resident._id)  // Use _id for comparison
                        .sort((a, b) => new Date(b.date) - new Date(a.date));

                    const lastPayment = payments[0];
                    const paidUntil = lastPayment ? new Date(lastPayment.periodEnd) : null;
                    const daysOverdue = paidUntil ? 
                        Math.ceil((today - paidUntil) / (1000 * 60 * 60 * 24)) : 
                        0;

                    return {
                        residentId: resident._id,  // Use _id for consistency
                        residentName: `${resident.firstName} ${resident.lastName}`,
                        programFee: resident.residencyDetails?.programFee || 850,
                        daysOverdue: Math.max(0, daysOverdue),
                        lastPayment: lastPayment ? lastPayment.date : null,
                        lastPaymentAmount: lastPayment ? lastPayment.amount : 0,
                        balance: lastPayment ? lastPayment.balance : (resident.residencyDetails?.programFee || 850)
                    };
                })
                .filter(p => p.daysOverdue > 0);
        }

        // Load payments
        function loadPayments() {
            console.log('Loading payments...');
            ContactService.getPayments()
                .then(function(response) {
                    console.log('Loaded payments:', response.data);
                    console.log('Sample payment data:', response.data[0]); // Log first payment for structure
                    $scope.payments = response.data;
                    calculateOverduePayments();
                    // If a resident is selected, refresh their payments
                    if ($scope.selectedResident) {
                        $scope.residentPayments = $scope.getResidentPayments();
                    }
                })
                .catch(function(error) {
                    console.error('Error loading payments:', error);
                    $mdToast.show(
                        $mdToast.simple()
                            .textContent('Error loading payments')
                            .position('top right')
                            .hideDelay(3000)
                    );
                });
        }

        // Watch for currentView changes
        $scope.$watch('currentView', function(newView) {
            console.log('Current view changed to:', newView);
            if (newView === 'ledger') {
                loadPayments();
                updateResidentsList();
            }
        });

        // Get resident payments
        $scope.getResidentPayments = function() {
            if (!$scope.selectedResident) {
                console.log('No resident selected');
                return [];
            }
            
            const residentId = $scope.selectedResident._id;
            console.log('Getting payments for resident ID:', residentId);
            
            return $scope.payments.filter(payment => 
                String(payment.residentId) === String(residentId)
            ).sort((a, b) => new Date(b.date) - new Date(a.date));
        };

        // Get resident's current month payment
        $scope.getCurrentMonthPayment = function() {
            if (!$scope.selectedResident?._id) return null;
            
            const today = new Date();
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            
            return $scope.residentPayments.find(payment => {
                const paymentDate = new Date(payment.date);
                return paymentDate.getMonth() === currentMonth &&
                       paymentDate.getFullYear() === currentYear;
            });
        };

        // Get resident's last payment
        $scope.getLastPayment = function() {
            if (!$scope.selectedResident?._id || !$scope.residentPayments?.length) return null;
            return $scope.residentPayments[0]; // Already sorted by date
        };

        // Get resident program fee
        $scope.getResidentProgramFee = function() {
            if (!$scope.selectedResident?._id) return 0;
            return $scope.selectedResident.residencyDetails?.programFee || 850;
        };

        // Get resident balance
        $scope.getResidentBalance = function() {
            if (!$scope.selectedResident?._id) return 0;
            
            const currentMonthPayment = $scope.getCurrentMonthPayment();
            const lastPayment = $scope.getLastPayment();
            const programFee = $scope.getResidentProgramFee();
            
            if (currentMonthPayment) {
                return currentMonthPayment.balance;
            } else if (lastPayment) {
                return lastPayment.balance + programFee;
            }
            return programFee;
        };

        // Get next payment due date
        $scope.getNextPaymentDue = function() {
            if (!$scope.selectedResident?._id) return null;
            
            const today = new Date();
            const currentMonthPayment = $scope.getCurrentMonthPayment();
            
            if (currentMonthPayment) {
                // Next month's 5th if paid this month
                return new Date(today.getFullYear(), today.getMonth() + 1, 5);
            }
            // This month's 5th if not paid yet
            return new Date(today.getFullYear(), today.getMonth(), 5);
        };

        // Get payment status
        $scope.getPaymentStatus = function() {
            if (!$scope.selectedResident?._id) return '';
            
            const today = new Date();
            const currentMonthPayment = $scope.getCurrentMonthPayment();
            const dueDate = new Date(today.getFullYear(), today.getMonth(), 5);
            
            if (currentMonthPayment) {
                return 'On Time';
            }
            
            const daysLate = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
            if (daysLate <= 0) return 'On Time';
            if (daysLate <= 30) return 'Late';
            return '>30 Days Late';
        };

        // Record Payment function
        $scope.recordPayment = function(residentId) {
            $mdDialog.show({
                templateUrl: 'record-payment-modal.html',
                controller: PaymentController,
                locals: {
                    residentId: residentId,
                    residents: $scope.residents.map(r => ({
                        _id: r._id,
                        firstName: r.firstName,
                        lastName: r.lastName
                    }))
                },
                clickOutsideToClose: false
            }).then(function(result) {
                if (result) {
                    loadPayments();
                }
            });
        };

        // Payment Modal Controller
        function PaymentController($scope, $mdDialog, ContactService, residentId, residents, $mdToast) {
            $scope.residents = residents;
            $scope.payment = {
                date: new Date(),
                residentId: residentId || '',
                amount: null,
                paymentType: '',
                periodStart: null,
                periodEnd: null,
                notes: ''
            };

            $scope.isValid = function() {
                return $scope.payment.residentId &&
                       $scope.payment.date &&
                       $scope.payment.amount > 0 &&
                       $scope.payment.paymentType &&
                       $scope.payment.periodStart &&
                       $scope.payment.periodEnd;
            };

            $scope.save = function() {
                if (!$scope.isValid()) {
                    $mdToast.show(
                        $mdToast.simple()
                            .textContent('Please fill in all required fields')
                            .position('top right')
                            .hideDelay(3000)
                    );
                    return;
                }

                ContactService.recordPayment($scope.payment)
                    .then(function(response) {
                        $mdToast.show(
                            $mdToast.simple()
                                .textContent('Payment recorded successfully')
                                .position('top right')
                                .hideDelay(3000)
                        );
                        $mdDialog.hide(response.data);
                    })
                    .catch(function(error) {
                        console.error('Error recording payment:', error);
                        $mdToast.show(
                            $mdToast.simple()
                                .textContent('Error recording payment')
                                .position('top right')
                                .hideDelay(3000)
                        );
                    });
            };

            $scope.cancel = function() {
                $mdDialog.cancel();
            };
        }

        // Initial load
        loadContacts();

        // Handle ledger view change
        $scope.handleLedgerViewChange = function() {
            console.log('handleLedgerViewChange called, new view:', $scope.ledgerView);
            if ($scope.ledgerView === 'resident') {
                console.log('Switching to resident view...');
                updateResidentsList();
                // Reset selected resident when switching to resident view
                $scope.selectedResident = null;
                $scope.residentPayments = [];
            } else if ($scope.ledgerView === 'all') {
                console.log('Switching to all payments view...');
                loadPayments();
            } else if ($scope.ledgerView === 'overdue') {
                console.log('Switching to overdue payments view...');
                calculateOverduePayments();
            }
        };

        // Function to delete a contact
        $scope.deleteContact = function(contact, event) {
            event.stopPropagation(); // Prevent opening the contact details modal
            
            const confirm = $mdDialog.confirm()
                .title('Delete Contact')
                .textContent(`Are you sure you want to delete ${contact.firstName} ${contact.lastName}?`)
                .ariaLabel('Delete Contact')
                .targetEvent(event)
                .ok('Delete')
                .cancel('Cancel');

            $mdDialog.show(confirm).then(function() {
                ContactService.deleteContact(contact._id)
                    .then(function() {
                        // Remove contact from the list
                        $scope.contacts = $scope.contacts.filter(c => c._id !== contact._id);
                        // Recalculate stats
                        calculateStats($scope.contacts);
                        
                        $mdToast.show(
                            $mdToast.simple()
                                .textContent('Contact deleted successfully')
                                .position('top right')
                                .hideDelay(3000)
                        );
                    })
                    .catch(function(error) {
                        console.error('Error deleting contact:', error);
                        $mdToast.show(
                            $mdToast.simple()
                                .textContent('Error deleting contact')
                                .position('top right')
                                .hideDelay(3000)
                        );
                    });
            });
        };

        // Add chart initialization and update functions
        $scope.initResidentChart = function() {
            const ctx = document.getElementById('residentChart').getContext('2d');
            
            // Register the datalabels plugin
            Chart.register(ChartDataLabels);
            
            $scope.residentChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            '#2c5530', // Current Residents (dark green)
                            '#4CAF50', // Pipeline Residents (light green)
                            '#c0392b', // Relapse (red)
                            '#3498db', // Discharged Home (blue)
                            '#e67e22', // Dismissed for Cause (orange)
                            '#95a5a6'  // Dismissed for Non-Payment (gray)
                        ],
                        borderWidth: 2,
                        borderColor: '#ffffff',
                        hoverOffset: 15,
                        hoverBorderWidth: 0,
                        spacing: 3,
                        borderRadius: 3,
                        offset: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    radius: '90%',
                    layout: {
                        padding: {
                            top: 20,
                            bottom: 20,
                            left: 20,
                            right: 20
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            titleColor: '#2c5530',
                            titleFont: {
                                size: 14,
                                weight: 'bold',
                                family: "'Noto Sans', sans-serif"
                            },
                            bodyColor: '#2c5530',
                            bodyFont: {
                                size: 13,
                                family: "'Noto Sans', sans-serif"
                            },
                            padding: 12,
                            boxPadding: 8,
                            cornerRadius: 8,
                            displayColors: true,
                            borderColor: 'rgba(44, 85, 48, 0.1)',
                            borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.raw || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                            }
                        },
                        datalabels: {
                            color: '#fff',
                            textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                            font: {
                                weight: 'bold',
                                size: 13,
                                family: "'Noto Sans', sans-serif"
                            },
                            formatter: function(value, context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return percentage + '%';
                            },
                            display: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const value = context.dataset.data[context.dataIndex];
                                const percentage = (value / total) * 100;
                                return percentage > 5; // Only show label if segment is > 5%
                            }
                        }
                    },
                    animation: {
                        animateRotate: true,
                        animateScale: true,
                        duration: 1000,
                        easing: 'easeOutQuart'
                    },
                    elements: {
                        arc: {
                            borderAlign: 'inner'
                        }
                    }
                }
            });
        };

        $scope.updateResidentChart = function() {
            const residentStats = {
                'Current Residents': 0,
                'Pipeline Residents': 0,
                'Relapse': 0,
                'Discharged Home': 0,
                'Dismissed for Cause': 0,
                'Dismissed for Non-Payment': 0
            };

            // Count residents by type and discharge reason
            $scope.contacts.forEach(contact => {
                if (contact.type === 'Resident') {
                    residentStats['Current Residents']++;
                } else if (contact.type === 'ResidentPipeline') {
                    residentStats['Pipeline Residents']++;
                } else if (contact.type === 'PastResident' && contact.residencyDetails?.dischargeReason) {
                    residentStats[contact.residencyDetails.dischargeReason]++;
                }
            });

            // Update chart data
            const labels = Object.keys(residentStats);
            const data = Object.values(residentStats);
            const total = data.reduce((a, b) => a + b, 0);

            $scope.residentChart.data.labels = labels;
            $scope.residentChart.data.datasets[0].data = data;
            $scope.residentChart.update();

            // Update legend
            $scope.chartLegend = labels.map((label, index) => ({
                label: label,
                color: $scope.residentChart.data.datasets[0].backgroundColor[index],
                count: data[index],
                percentage: ((data[index] / total) * 100).toFixed(1)
            }));
        };

        // Update chart when view changes or contacts are loaded
        $scope.$watch('currentView', function(newView, oldView) {
            console.log('View changed from', oldView, 'to:', newView);
            if (oldView === 'analytics' && $scope.residentChart) {
                console.log('Destroying old chart');
                $scope.residentChart.destroy();
                $scope.residentChart = null;
            }
            
            if (newView === 'analytics') {
                console.log('Initializing analytics chart');
                // Use timeout to ensure DOM is ready
                $timeout(function() {
                    $scope.initResidentChart();
                    $scope.updateResidentChart();
                }, 100);
            }
        });

        $scope.$watch('contacts', function(newContacts) {
            if (newContacts && $scope.currentView === 'analytics') {
                console.log('Contacts updated, updating chart');
                if (!$scope.residentChart) {
                    console.log('Chart not found, initializing');
                    $timeout(function() {
                        $scope.initResidentChart();
                        $scope.updateResidentChart();
                    }, 100);
                } else {
                    console.log('Updating existing chart');
                    $scope.updateResidentChart();
                }
            }
        }, true);
    }
})(); 