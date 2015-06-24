
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
  var dataTable = new gapi.analytics.googleCharts.DataChart({
    query: {
      dimensions: 'ga:date',
      metrics: 'ga:users',
      'sort': '-ga:users',
      'max-results': '6'
    },
    chart: {
      container: 'table-container',
      type: 'TABLE',
      options: {
        width: '100%'
      }
    }
  });


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
   * with the id "sessions-chart-container".
   */
  var dataChartsessions = new gapi.analytics.googleCharts.DataChart({
    query: {
      metrics: 'ga:sessions',
      dimensions: 'ga:date',
      'start-date': '30daysAgo',
      'end-date': 'yesterday'
    },
    chart: {
      container: 'sessions-chart-container',
      type: 'LINE',
      options: {
        width: '100%'
      }
    }
  });

    /**
   * Create a new DataChart instance with the given query parameters
   * and Google chart options. It will be rendered inside an element
   * with the id "pageviews-chart-container".
   */
  var dataChartpageviews = new gapi.analytics.googleCharts.DataChart({
    query: {
      metrics: 'ga:pageviews',
      dimensions: 'ga:date',
      'start-date': '30daysAgo',
      'end-date': 'yesterday'
    },
    chart: {
      container: 'pageviews-chart-container',
      type: 'LINE',
      options: {
        width: '100%'
      }
    }
  });

    /**
   * Create a new DataChart instance with the given query parameters
   * and Google chart options. It will be rendered inside an element
   * with the id "bounces-chart-container".
   */
  var dataChartbounces = new gapi.analytics.googleCharts.DataChart({
    query: {
      metrics: 'ga:bounces',
      dimensions: 'ga:date',
      'start-date': '30daysAgo',
      'end-date': 'yesterday'
    },
    chart: {
      container: 'bounces-chart-container',
      type: 'LINE',
      options: {
        width: '100%'
      }
    }
  });

  /**
   * Create a new DataChart instance with the given query parameters
   * and Google chart options. It will be rendered inside an element
   * with the id "pages-session-chart-container".
   */
  var dataChartpageviewssession = new gapi.analytics.googleCharts.DataChart({
    query: {
      metrics: 'ga:pageviewsPerSession',
      dimensions: 'ga:date',
      'start-date': '30daysAgo',
      'end-date': 'yesterday'
    },
    chart: {
      container: 'pages-session-chart-container',
      type: 'LINE',
      options: {
        width: '100%'
      }
    }
  });

  /**
   * Create a new DataChart instance with the given query parameters
   * and Google chart options. It will be rendered inside an element
   * with the id "sessions-user-chart-container".
   */
  var dataChartsessionsuser = new gapi.analytics.googleCharts.DataChart({
    query: {
      metrics: 'ga:sessionsPerUser',
      dimensions: 'ga:date',
      'start-date': '30daysAgo',
      'end-date': 'yesterday'
    },
    chart: {
      container: 'sessions-user-chart-container',
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
    dataTable.set({query: {ids: ids}}).execute();
    dataChartusers.set({query: {ids: ids}}).execute();
    dataChartsessions.set({query: {ids: ids}}).execute();
    dataChartpageviews.set({query: {ids: ids}}).execute();
    dataChartbounces.set({query: {ids: ids}}).execute();
    dataChartpageviewssession.set({query: {ids: ids}}).execute();
    dataChartsessionsuser.set({query: {ids: ids}}).execute();
  });

});
