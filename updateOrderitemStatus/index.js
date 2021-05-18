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
  let OI_NR = event.OI_NR;    //OrderItemNr
  let O_NR = event.O_NR;      //OrderNr
  let IST_NR = event.IST_NR;  //ItemState


  try{
    //Prüfen ob der User existiert
    await callDBResonse(pool, checkOrderExist(O_NR,OI_NR));
    if(res == null){
      message = 'Die Position '+ OI_NR +' der Bestellung ' + O_NR + ' wurde nicht gefunden.';
      
      response = {
        statusCode: 404,
        errorMessage: message,
        errorType: "Not Found"
      };
      
      //Fehler schmeisen
      context.fail(JSON.stringify(response));
    }
    else{
      //Prüfen ob der Status existiert
      await callDBResonse(pool, checkStatusExist(IST_NR));
      if(res == null){
        message = 'Die Status-Nummer '+ IST_NR +' wurde nicht gefunden.';
        
        response = {
          statusCode: 400,
          errorMessage: message,
          errorType: "Bad Request"
        };
        //Fehler schmeisen
        context.fail(JSON.stringify(response));
      }
      else{
        //Order aktualisieren
        await callDB(pool, updateOrderitemStatus(O_NR,OI_NR,IST_NR));
        
        var messageJSON = {
          message: 'Der Status der Position '+ OI_NR +' der Bestellung ' + O_NR + ' wurde aktualisiert.'
        };
  
        response = {
          statusCode: 200,
          message: JSON.stringify(messageJSON)
        }; 
        return response;
      }
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
          res = JSON.parse(JSON.stringify(results[0]));
          return results;
        }
      })
    .catch();
}


//******* SQL Statements *******

const updateOrderitemStatus = function (O_NR, OI_NR, IST_NR) {
  var queryMessage = "UPDATE ORDER.ORDERITEM SET OI_IST_NR = " + IST_NR + " WHERE OI_O_NR = " + O_NR + " AND OI_NR = " + OI_NR + ";";
  console.log(queryMessage);
  return (queryMessage);
};

const checkOrderExist= function (O_NR,OI_NR) {
  var queryMessage = "SELECT * FROM ORDER.ORDERITEM WHERE OI_O_NR = " + O_NR + " AND OI_NR = " + OI_NR + ";";
  console.log(queryMessage);
  return (queryMessage);
};

const checkStatusExist= function (IST_NR) {
  var queryMessage = "SELECT * FROM ORDER.ITEMSTATE WHERE IST_NR = " + IST_NR + ";";
  console.log(queryMessage);
  return (queryMessage);
};