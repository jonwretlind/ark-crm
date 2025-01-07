angular.module('arkCRM', ['ngMaterial', 'ngAnimate', 'ngAria'])
    .config(function($mdThemingProvider) {
        // Define custom palettes
        var darkGreenPalette = $mdThemingProvider.extendPalette('green', {
            '500': '#2c5530',
            '700': '#1e3b21'
        });
        
        var rustyOrangePalette = $mdThemingProvider.extendPalette('orange', {
            '500': '#d35400',
            '700': '#a04000'
        });

        // Register custom palettes
        $mdThemingProvider.definePalette('darkGreen', darkGreenPalette);
        $mdThemingProvider.definePalette('rustyOrange', rustyOrangePalette);

        $mdThemingProvider.theme('default')
            .primaryPalette('darkGreen')
            .accentPalette('rustyOrange');
    })
    .factory('ObjectId', function() {
        return function(id) {
            if (!id) return null;
            return {
                toString: function() {
                    return id;
                }
            };
        };
    }); 