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
  let O_NR = event.O_NR;  //Ordernummer
  

  try{
    //Prüfen ob die Bestellungen existieren
    await callDBResonse(pool, checkOrderExist(O_NR));
    console.log(res);
    if(res == null){
      message = 'Keine Bestellungen mit der Nummer ' + O_NR + ' gefunden.';
      
      response = {
        statusCode: 404,
        errorMessage: message,
        errorType: "Not Found"
      };
      
      //Fehler schmeisen
      context.fail(JSON.stringify(response));
    }
    else if(res[0].O_OST_NR != 9){
      message = 'Es können nur Aufträge im Status Entwurf gelöscht werden.';
        
      response = {
        statusCode: 400,
        errorMessage: message,
        errorType: "Bad Request"
      };
      //Fehler schmeisen
      context.fail(JSON.stringify(response));
    }
    else{
      //Image löschen
      await callDB(pool, deleteOrderImages(O_NR));

      //QualityIssues löschen
      await callDB(pool, deleteOrderQualityIssue(O_NR));

      //Return Items löschen
      await callDB(pool, deleteOrderItemreturn(O_NR));
      
      //Orderitems löschen
      await callDB(pool, deleteOrderItems(O_NR));

      //Order löschen
      await callDB(pool, deleteOrder(O_NR));

      var messageJSON = {
        message: 'Der Auftrag wurde gelöscht.'
      };

      response = {
        statusCode: 200,
        message: JSON.stringify(messageJSON)
      }; 
      return response;
    }
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
          res = JSON.parse(JSON.stringify(results));
          return results;
        }
      })
    .catch();
}

//******* SQL Statements *******

const checkOrderExist = function (O_NR) {
  var queryMessage = "SELECT * FROM ORDER.ORDER WHERE O_NR='" + O_NR + "';";
  //console.log(queryMessage);
  return (queryMessage);
};

const deleteOrder = function (O_NR) {
  var queryMessage = "DELETE FROM `ORDER`.`ORDER` WHERE (`O_NR` = '" + O_NR + "');";
  //console.log(queryMessage);
  return (queryMessage);
};

const deleteOrderItems = function (O_NR) {
  var queryMessage = "DELETE FROM `ORDER`.`ORDERITEM` WHERE (`OI_O_NR` = '" + O_NR + "');";
  //console.log(queryMessage);
  return (queryMessage);
};

const deleteOrderImages = function (O_NR) {
  var queryMessage = "DELETE FROM `ORDER`.`IMAGE` WHERE (`IM_O_NR` = '" + O_NR + "');";
  //console.log(queryMessage);
  return (queryMessage);
};

const deleteOrderItemreturn = function (O_NR) {
  var queryMessage = "DELETE * FROM `QUALITY`.`ITEMRETURN` WHERE IR_O_NR='" + O_NR + "';";
  //console.log(queryMessage);
  return (queryMessage);
};

const deleteOrderQualityIssue = function (O_NR) {
  var queryMessage = "DELETE * FROM `QUALITY`.`QUALITYISSUE` WHERE QI_O_NR='" + O_NR + "';";
  //console.log(queryMessage);
  return (queryMessage);
};