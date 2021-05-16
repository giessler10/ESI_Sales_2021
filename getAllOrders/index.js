//******* IMPORTS *******

const mysql = require('mysql2/promise');
var config = require('./config');


//******* GLOBALS *******

var res;
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
      //get all Customers
      await callDBResonse(pool, getAllOrders());
      results = res;
      //console.log(results);
  
      const response = {
        statusCode: 200,
        body: results
      };
  
      console.log(response);
      return response;
    }
    catch (error) {
      console.log(error);
      return {
        statusCode: 400,
        "Error": "Function catched an error"
      };
    }
    finally {
      await pool.end();
    }
  };

//******* DB Call Functions *******

async function callDB(client, queryMessage) {
    await client.query(queryMessage)
      .catch(console.log);
};

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

const getAllOrders = function () {
    var queryMessage = "SELECT * FROM ORDERS.ORDER;";
    //console.log(queryMessage)
    return (queryMessage);
};