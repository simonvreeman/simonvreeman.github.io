
gapi.analytics.ready(function() {

  /**
   * Authorize the user immediately if the user has already granted access.
   * If no access has been created, render an authorize button inside the
   * element with the ID "embed-api-auth-container".
   */
  gapi.analytics.auth.authorize({
    container: 'embed-api-auth-container',
    clientid: '989242002732-f25ang5mpnf8ukv6qbka15oud3a2um64.apps.googleusercontent.com',
  });


  /**
   * Create a new ViewSelector instance to be rendered inside of an
   * element with the id "view-selector-container".
   */
  var viewSelector = new gapi.analytics.ViewSelector({
    container: 'view-selector-container'
  });

  // Render the view selector to the page.
  viewSelector.execute();


  /**
   * Create a new DataChart instance with the given query parameters
   * and Google chart options. It will be rendered inside an element
   * with the id "users-chart-container".
   */
  var dataChartusers = new gapi.analytics.googleCharts.DataChart({
    query: {
      metrics: 'ga:users',
      dimensions: 'ga:date',
      'start-date': '30daysAgo',
      'end-date': 'yesterday'
    },
    chart: {
      container: 'users-chart-container',
      type: 'LINE',
      options: {
        width: '100%'
      }
    }
  });

  /**
   * Create a new DataChart instance with the given query parameters
   * and Google chart options. It will be rendered inside an element
   * with the id "transactions-chart-container".
   */
  var dataCharttransactions = new gapi.analytics.googleCharts.DataChart({
    query: {
      metrics: 'ga:transactions',
      dimensions: 'ga:date',
      'start-date': '30daysAgo',
      'end-date': 'yesterday'
    },
    chart: {
      container: 'transactions-chart-container',
      type: 'LINE',
      options: {
        width: '100%'
      }
    }
  });

  /**
   * Create a new DataChart instance with the given query parameters
   * and Google chart options. It will be rendered inside an element
   * with the id "transactionRevenue-chart-container".
   */
  var dataCharttransactionRevenue = new gapi.analytics.googleCharts.DataChart({
    query: {
      metrics: 'ga:transactionRevenue',
      dimensions: 'ga:date',
      'start-date': '30daysAgo',
      'end-date': 'yesterday'
    },
    chart: {
      container: 'transactionRevenue-chart-container',
      type: 'LINE',
      options: {
        width: '100%'
      }
    }
  });


  /**
   * Render the dataChart on the page whenever a new view is selected.
   */
  viewSelector.on('change', function(ids) {
    dataChartusers.set({query: {ids: ids}}).execute();
    dataCharttransactions.set({query: {ids: ids}}).execute();
    dataCharttransactionRevenue.set({query: {ids: ids}}).execute();
  });

});