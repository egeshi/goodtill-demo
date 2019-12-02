'use strict';

/**
 * @author: Anton Repin <antony@lehcode.com>
 */
const TestApp = (angular.module('TestApp', [
  'ui.router',
  'ngResource',
  'ngRoute',
  'ngSanitize',
  'ui.bootstrap',
]).
    config([
      '$stateProvider',
      '$urlRouterProvider',
      '$locationProvider',
      '$routeProvider',
      '$qProvider',
      (
          $stateProvider,
          $urlRouterProvider,
          $locationProvider,
          $routeProvider,
          $qProvider,
      ) => {
        /**
         * Redirect root to login
         */
        $urlRouterProvider.when('/', '/login');
        /**
         * Redirect on any unmatched url
         */
        $urlRouterProvider.otherwise('/under-construction');

        const pages = {
          'login': {
            url: '/login',
            controller: 'LoginController',
            templateUrl: 'views/login.html',
            data: {pageTitle: 'Login to Test System'},
          },
          'dashboard': {
            url: '/dashboard',
            controller: 'DashboardController',
            templateUrl: 'views/dashboard.html',
            data: {pageTitle: 'Dashboard :: Test System'},
          },
        };

        /**
         * Add API states to app
         */
        angular.forEach(pages, function(props, alias) {
          $stateProvider.state(alias, Object.assign({resolve: {}}, props));
        });

        $locationProvider.html5Mode(true);
        $qProvider.errorOnUnhandledRejections(false);
      },
    ]).
    controller('ApplicationController', [
      '$scope',
      '$rootScope',
      '$state',
      '$q',
      '$http',
      'settings',
      '$location',
      '$window',
      /**
       * Root Application controller
       */
      function(
          $scope,
          $rootScope,
          $state,
          $q,
          $http,
          settings,
          $location,
          $window,
      ) {
        $scope.state = $state;

        $scope.$on('$viewContentLoaded', () => {
          if (!$window.localStorage['token']) {
            $location.path('/login');
            $rootScope.user = settings.user.defaults;
          }
        });

        /**
         * Collect form errors
         *
         * @param angularForm Object
         * @returns {Array}
         */
        $rootScope.getFormErrors = function(angularForm) {
          $scope.alerts = [];
          let messages = [];

          console.warn('Form is invalid', angularForm);

          angular.forEach(angularForm.$error, (el, cond) => {
            el.forEach((element) => {
              if (element.$name === '') {
                throw new Error('element.$name attribute not defined!');
              } else {
                messages.push(`${element.$name} is ${cond}`);
              }
            });
          });
          return messages;
        };
      },
    ]).
    controller('LoginController', [
      '$scope',
      '$rootScope',
      '$state',
      'settings',
      '$window',
      'api',
      function(
          $scope,
          $rootScope,
          $state,
          settings,
          $window,
          api,
      ) {
        console.log('Initializing LoginController');

        $scope.$on('$viewContentLoaded', (evt) => {
          //
        });

        /**
         * Process user login
         */
        $scope.doLogin = function() {
          if (this.loginForm.$valid) {
            api.post('/login', $scope.user).
                then((response) => {
                  $rootScope.data = response;
                  settings.user.auth.token = $rootScope.data.token;
                  $window.localStorage['token'] = settings.user.auth.token;
                  $window.localStorage['storeName'] = $rootScope.data.client_name;
                  $state.go('dashboard');
                });
          } else {
            this.loginForm.$setDirty();
            let alerts = '';
            $rootScope.getFormErrors(this.loginForm).
                forEach((msg) => {
                  alerts += msg + '<br/>';
                });
            console.log(alerts);
          }
        };
      },
    ])).
    controller('DashboardController', [
      '$scope',
      '$rootScope',
      'api',
      '$window',
      'lcfirstFilter',
      function(
          $scope,
          $rootScope,
          api,
          $window,
          lcfirstFilter,
      ) {
        console.log('Initializing DashboardController');

        const dates = {
          this_week: {
            text: 'This week',
            dateFrom: moment().
                subtract(7, 'days').
                day(1).
                hour(0).
                minute(0).
                second(0),
            dateTo: null,
          },
          this_month: {
            text: 'This month',
            dateFrom: moment().
                startOf('month').
                hour(0).
                minute(0).
                second(0),
            dateTo: null,
          },
          last_week: {
            text: 'Last seven days',
            dateFrom: moment().
                subtract(7, 'days').
                hour(0).
                minute(0).
                second(0),
            dateTo: moment().
                hour(0).
                minute(0).
                second(0),
          },
          last_month: {
            text: 'Last 30 days',
            dateFrom: moment().
                subtract(1, 'months').
                hour(0).
                minute(0).
                second(0),
            dateTo: moment().
                hour(0).
                minute(0).
                second(0),
          },
        };

        $scope.$on('getDropdownItems', (evt) => {
          const items = [];
          Object.values(dates).
              forEach((val) => {
                items.push(val.text);
              });
          evt.targetScope.setDropdownItems(items);
        });

        $scope.$on('selectedValue', (evt, value) => {
          Object.values(dates).
              forEach((val) => {
                if (val.text === value) {
                  $scope.selectedDate = val.dateFrom;
                  $scope.selectedDateText = val.text;
                  $scope.allSales = null;
                  $scope.summary = {
                    total_amt: 0,
                    total_items_amt: 0,
                    total_money: 0,
                    avg_items_per_sale: 0,
                    avg_money_per_sale: 0,
                  };
                  updateScreen(val.dateFrom, val.dateTo);
                }
              });
        });

        function updateScreen(startDate, endDate) {
          let url = `/external/get_sales?from=${startDate.format('YYYY-MM-DD')}`;
          if (endDate) url += `&to=${endDate.format('YYYY-MM-DD')}`;

          api.get(url).
              then((salesData) => {
                $scope.allSales = salesData;
                $scope.summary.total_amt = $scope.allSales.data.length + 1;

                $scope.allSales.data.forEach((sale, idx) => {
                  sale.items.forEach((item) => {
                    $scope.summary.total_money += parseFloat(item.total_inc_vat);
                    $scope.summary.total_items_amt += parseInt(item.quantity);
                  });
                  $scope.summary.avg_money_per_sale += sale.total_inc_vat;
                  $scope.summary.avg_items_per_sale += sale.items.length;
                });
                $scope.summary.avg_items_per_sale = (Math.round(
                    ($scope.summary.avg_items_per_sale / $scope.summary.total_amt) * 100) / 100).toFixed(2);
                $scope.summary.avg_money_per_sale = (Math.round(
                    ($scope.summary.avg_money_per_sale / $scope.summary.total_amt) * 100) / 100).toFixed(2);
                $scope.summary.total_money = (Math.round($scope.summary.total_money * 100) / 100).toFixed(2);
                $scope.$digest();
              });
        }

        $scope.storeName = $window.localStorage['storeName'];

      },
    ]).
    controller('DropdownController', [
      '$scope',
      '$rootScope',
      (
          $scope,
          $rootScope,
      ) => {
        $scope.status = {
          isopen: false,
        };

        $scope.toggled = function(open) {
          $log.log('Dropdown is now: ', open);
        };

        $scope.toggleDropdown = function($event) {
          $event.preventDefault();
          $event.stopPropagation();
          $scope.status.isopen = !$scope.status.isopen;
        };

        $scope.setDropdownItems = function(data) {
          $scope.items = data;
        };

        $scope.rangeSelected = function(selectedValue) {
          this.$emit('selectedValue', selectedValue);
        };

        $scope.$emit('getDropdownItems');
        // $scope.appendToEl = angular.element(document.querySelector('#DropdownContainer'));
      }]).
    run([
      '$rootScope', 'settings', '$state', '$location',
      ($rootScope, settings, $state, $location) => {
        $rootScope.$state = $state;
        $rootScope.$settings = settings;
      }]);

TestApp.factory('settings', [
  '$rootScope',
  function($rootScope) {
    const settings = {
      apiBaseUrl: 'https://api.thegoodtill.com/api',
      user: {
        defaults: {
          subdomain: 'externaldemo',
          username: 'assessment',
          password: '9BJsL3essWhcWFKc',
        },
        auth: {
          token: null,
        },
      },
    };

    $rootScope.settings = settings;
    $rootScope.stores = {};

    return settings;
  },
]);

TestApp.factory('api', [
  '$rootScope',
  '$http',
  'settings',
  '$location',
  '$window',
  function(
      $rootScope,
      $http,
      settings,
      $location,
      $window,
  ) {
    let api = {};
    let httpHeaders = {
      'Content-Type': 'application/json',
    };

    async function call(method, url, data) {
      let params = {
        'async': true,
        'crossDomain': true,
        method: method,
        url: `${$rootScope.settings.apiBaseUrl}${url}`,
        data: data,
        headers: Object.assign(httpHeaders, {
          'Authorization': `Bearer ${$window.localStorage['token']}`,
        }),
      };

      console.debug('Request: ', params);

      return await $http(params).
          then((response) => {
                console.debug(response);
                return response.data;
              },
              (error) => {
                settings.token = null;
                $window.localStorage['token'] = null;
                $location.path('/login');
              });
    }

    api.get = function(url) {
      return call('GET', url).
          then((json) => json);
    };

    api.post = function(url, data) {
      return call('POST', url, data).
          then((json) => json);
    };

    return api;
  },
]);

TestApp.filter('lcfirst', () => {
  return (input) => {
    input = input || '';

    if (input.length) {
      return input.charAt(0).
          toLowerCase() + input.substr(1);
    }
  };
});
