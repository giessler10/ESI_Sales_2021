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
  
    O_NR = event.O_NR;  //Order-Nummer
    
    try {
      //get all QualityIssues
      await callDBResonse(pool, getItemReturn(O_NR));
      results = res;
      //console.log(results);
  
      const response = {
        statusCode: 200,
        body: results
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

const getItemReturn = function (O_NR) {
    var queryMessage = "SELECT * FROM VIEWS.ITEMRETURNINFO WHERE IR_O_NR=" + O_NR + " ORDER BY IR_OI_NR;";
    //console.log(queryMessage)
    return (queryMessage);
};