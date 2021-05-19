//******* IMPORTS *******

const mysql = require('mysql2/promise');
var config = require('./config');


//******* GLOBALS *******

var res;
var message;
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

  // get event data
  //let O_NR = event.O_NR;  -> Not needed, because MySQL will automatically set the Number
  let O_C_NR = event.O_C_NR;  //Firma
  let O_OT_NR = event.O_OT_NR;
  //let O_OST_NR = event.O_OST_NR; -> Always set fixed value of 1 (Open) for Orderstate
  //let O_TIMESTAMP = event.O_TIMESTAMP; -> Not needed, because MySQL will automatically set the Timestamp when Data was Inserted



  try{

        
        //Neuen Kunden anlegen
        await callDB(pool, insertNewOrder(O_C_NR, O_OT_NR));
        
        //Abfrage neue Kundennummer
        await callDBResonse(pool, getNewOrderID());
        message = 'Der neue Auftrag hat die Nummer ' + res.newOrderID +'.';

        var messageJSON = {
        	message: message
        };
        
        response = {
        	statusCode: 200,
        	message: JSON.stringify(messageJSON)
        }; 
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
          res = null;
        }
        else{
          res = JSON.parse(JSON.stringify(results[0]));
          return results;
        }
      })
    .catch();
}


//******* SQL Statements *******

const insertNewOrder = function (O_C_NR, O_OT_NR) {
  var queryMessage = "INSERT INTO `ORDER`.`ORDER` (O_C_NR, O_OT_NR, O_OST_NR) VALUES ('" + O_C_NR + "', '" + O_OT_NR + "', 1);";
  console.log(queryMessage);
  return (queryMessage);
};

const getNewOrderID = function () {
    var queryMessage = "SELECT max(O_NR) as neworderID FROM VIEWS.ORDERINFO;";
    console.log(queryMessage);
    return (queryMessage);
};
