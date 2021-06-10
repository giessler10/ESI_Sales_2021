//******* IMPORTS *******

const mysql = require('mysql2/promise');
var config = require('./config');


//******* GLOBALS *******

var O_NR;
var res;
var response;
var results = [];

//******* DATABASE CONNECTION *******

const con = {
    host: config.host,
    user: config.user,
    password: config.password,
    port: config.port,
};

//******* EXPORTS HANDLER  *******

exports.handler = async (event, context, callback) => {
    const pool = await mysql.createPool(con);
    
    try {
      //get KPIs
      await callDBResonse(pool, getDashboardView());
      var KPI = res[0];
      
      //get ChartData
      //await callDBResonse(pool, getDashboardView());
      var chart= "Muss in der View noch ergänzt werden.";
      
      var body = {
        KPIs: KPI,
        chart: chart
      };
      body = JSON.stringify(body);
      //console.log(results);
  
      const response = {
        statusCode: 200,
        body: body
      };
  
      //console.log(response);
      return response;
    }
    catch (error) {
      console.log(error);
      
      response = {
        statusCode: 500,
        errorMessage: "Internal Server Error",
        errorType: "Internal Server Error"
      };
    
      //Fehler schmeisen
      context.fail(JSON.stringify(response));
    }
    finally {
      await pool.end();
    }
  };

//******* DB Call Functions *******

async function callDB(client, queryMessage) {
    await client.query(queryMessage)
      .catch(console.log);
}

async function callDBResonse(client, queryMessage) {
  var queryResult = 0;
  await client.query(queryMessage)
    .then(
      (results) => {
        queryResult = results[0];
        return queryResult;
      })
    .then(
      (results) => {
        //Prüfen, ob queryResult == []
        if(!results.length){
          //Kein Eintrag in der DB gefunden
          res = [];
        }
        else{
          res = JSON.parse(JSON.stringify(results));
          return results;
        }
      })
    .catch(console.log);
}

//******* SQL Statements *******

const getDashboardView = function() {
    var queryMessage = "SELECT * FROM VIEWS.DASHBOARD;";
    //console.log(queryMessage)
    return (queryMessage);
};