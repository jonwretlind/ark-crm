angular.module('arkCrm').controller('AnalyticsController', ['$scope', 'ContactService', '$timeout', '$rootScope',
function($scope, ContactService, $timeout, $rootScope) {
    $scope.legendItems = [];
    let chart = null;

    function destroyChart() {
        if (chart) {
            chart.destroy();
            chart = null;
        }
    }

    function createChart(data, labels, colors) {
        console.log('Creating chart...');
        const canvas = document.getElementById('residentChart');
        if (!canvas) {
            console.error('Canvas element not found');
            return;
        }

        const ctx = canvas.getContext('2d');
        chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderColor: 'rgba(255, 255, 255, 0.8)',
                    borderWidth: 2,
                    hoverOffset: 15,
                    spacing: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        titleColor: '#2c5530',
                        bodyColor: '#2c5530',
                        bodyFont: {
                            size: 14
                        },
                        padding: 12,
                        cornerRadius: 8,
                        boxPadding: 6,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${value} residents (${percentage}%)`;
                            }
                        }
                    }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true
                }
            }
        });
        console.log('Chart created:', chart);
    }

    function initAnalytics() {
        console.log('Initializing analytics...');
        destroyChart();
        
        ContactService.getContacts().then(function(contacts) {
            console.log('Got contacts:', contacts.length);
            const totalResidents = contacts.filter(c => c.type === 'Resident').length;
            const pastResidents = contacts.filter(c => c.type === 'PastResident').length;
            const pipelineResidents = contacts.filter(c => c.type === 'PipelineResident').length;
            const total = totalResidents + pastResidents + pipelineResidents;

            const data = [totalResidents, pastResidents, pipelineResidents];
            const labels = ['Current Residents', 'Past Residents', 'Pipeline Residents'];
            const colors = ['#2c5530', '#4a8f50', '#7ab97f'];

            $scope.legendItems = data.map((value, index) => ({
                label: labels[index],
                count: value,
                percentage: ((value / total) * 100).toFixed(1),
                color: colors[index]
            }));

            // Use timeout to ensure DOM is ready
            $timeout(function() {
                createChart(data, labels, colors);
            }, 100);
        });
    }

    // Listen for view change event from MainController
    $rootScope.$on('viewChanged', function(event, view) {
        console.log('View changed event received:', view);
        if (view === 'analytics') {
            console.log('Analytics view detected, initializing...');
            $timeout(initAnalytics, 100);
        }
    });

    // Clean up when scope is destroyed
    $scope.$on('$destroy', function() {
        destroyChart();
    });

    // Initial load
    if ($scope.$parent.currentView === 'analytics') {
        $timeout(initAnalytics, 100);
    }
}]); 