//******* IMPORTS *******

const mysql = require('mysql2/promise');
var config = require('./config');


//******* GLOBALS *******

var C_NR;
var res;
var results = [];
var response;

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

    console.log(event.C_NR);
    C_NR = event.C_NR;
  
    try {
      //get Customer
      await callDBResonse(pool, getCustomer(C_NR));
      results = res;
      console.log(results);
      
      const response = {
        statusCode: 200,
        body: results
      };
  
      console.log(response);
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
    .catch();
}

//******* SQL Statements *******

const getCustomer = function (C_NR) {
    var queryMessage = "SELECT * FROM CUSTOMER.CUSTOMER WHERE C_NR='" + C_NR + "';";
    //console.log(queryMessage)
    return (queryMessage);
};