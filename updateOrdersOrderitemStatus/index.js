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
  let IST_NR = event.IST_NR;  //ItemState
  let orders = event.body;
  
  //Fehler schmeißen wenn Body kein Array ist.
  if (!Array.isArray(orders)) {
    message = 'Fehlerhafte Daten im Body';
        
    response = {
      statusCode: 400,
      errorMessage: message,
      errorType: "Bad Request"
    };
    //Fehler schmeisen
    context.fail(JSON.stringify(response));
  }


  try{
    //Prüfen ob die Bestellungen existieren
    await callDBResonse(pool, checkOrdersExist(orders));
    console.log(res);
    if(res == null){
      message = 'Keine Bestellungen gefunden.';
      
      response = {
        statusCode: 404,
        errorMessage: message,
        errorType: "Not Found"
      };
      
      //Fehler schmeisen
      context.fail(JSON.stringify(response));
    }
    else if(orders.length != res.length){
      message = 'Einige Bestellungen wurde nicht gefunden.';
      
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
        //Orderitems aktualisieren
        
        var sql = buildSQLString(orders, IST_NR);
        
        
        if(sql[0] != undefined){
          await callDB(pool, sql[0]); //New oder Preproduction
        }
        if(sql[1] != undefined){
          await callDB(pool, sql[1]); //Quality
        }
        
        if(sql[2] != undefined){
          await callDB(pool, sql[2]); //Item Return
        }

        var messageJSON = {
          message: 'Der Status der Positionen der Bestellung wurde aktualisiert.'
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
          res = JSON.parse(JSON.stringify(results));
          return results;
        }
      })
    .catch();
}

//************* Hilfsfunktionen *****************************

const buildSQLWhereString = function (orders) {
  var where = "WHERE (OI_O_NR = " + orders[0]["O_NR"] + " and OI_NR = " + orders[0]["OI_NR"] + ")";
  
  if (orders.length > 1) {
    for (var i = 1; i < orders.length; i++) {
      where += " OR (OI_O_NR = " + orders[i]["O_NR"] + " and OI_NR = " + orders[i]["OI_NR"] + ")";
    } 
  }

  return where;
};

function buildSQLString(orders, IST_NR) {
  var whereNew;
  var whereQS;
  var whereReturn;
  
  var queryMessageNew;
  var queryMessageQS;
  var queryMessageReturn;

  for (var i = 0; i < orders.length; i++) {
    //New (N) Orderitems or Preproduction (P)
    if (orders[i]["PO_CODE"] == "P" || orders[i]["PO_CODE"] == "N"){
      if (whereNew == undefined) {
        whereNew = "where (OI_O_NR = " + orders[i]["O_NR"] + " and OI_NR = " + orders[i]["OI_NR"] + ")";
      } 
      else{
       whereNew += " or (OI_O_NR = " + orders[i]["O_NR"] + " and OI_NR = " + orders[i]["OI_NR"] + ")";
      }
    }
    
    //Orderitems with Quality issues (Q)
    if (orders[i]["PO_CODE"] == "Q"){
      if (whereQS == undefined){
        whereQS = "where (QI_O_NR = " + orders[i]["O_NR"] + " and QI_OI_NR = " + orders[i]["OI_NR"] + " and QI_COUNTER = " + orders[i]["PO_COUNTER"] + ")";
      } 
      else{
       whereQS += " or (QI_O_NR = " + orders[i]["O_NR"] + " and QI_OI_NR = " + orders[i]["OI_NR"] + " and QI_COUNTER = '" + orders[i]["PO_COUNTER"] + ")";
      }
    } 
    
    //Orderitems that needs reproduction due to Return (R)
    if (orders[i]["PO_CODE"] == "R"){
      if (whereReturn == undefined){
        whereReturn = "where (IR_O_NR = " + orders[i]["O_NR"] + " and IR_OI_NR = " + orders[i]["OI_NR"] + " and IR_COUNTER = " + orders[i]["PO_COUNTER"] + ")";
      } 
      else{
        whereReturn += " or (IR_O_NR = " + orders[i]["O_NR"] + " and IR_OI_NR = " + orders[i]["OI_NR"] + " and IR_COUNTER = '" + orders[i]["PO_COUNTER"] + ")";
      }
    } 
  }
 
  if (whereNew != undefined) {
    queryMessageNew = "UPDATE ORDER.ORDERITEM SET OI_IST_NR = " + IST_NR + " " + whereNew + "";
  }
 
  if (whereQS != undefined) {
    queryMessageQS = "UPDATE QUALITY.QUALITYISSUE SET QI_IST_NR = " + IST_NR + " " + whereQS + "";
  }
  
  if (whereReturn != undefined) {
    queryMessageReturn = "UPDATE QUALITY.ITEMRETURN SET IR_IST_NR = " + " " +IST_NR + " " + whereReturn + "";
  }
  
  console.log("R " + queryMessageReturn);
  console.log("QS " + queryMessageQS);
  console.log("N " + queryMessageNew);
  
  return [queryMessageNew,queryMessageQS,queryMessageReturn];
}


//******* SQL Statements *******

const checkOrdersExist = function (orders) {
  var where = buildSQLWhereString(orders); //WHERE Statement
  var queryMessage = "SELECT * FROM ORDER.ORDERITEM " + where + ";";
  //console.log(queryMessage);
  return (queryMessage);
};

const checkStatusExist = function (IST_NR) {
  var queryMessage = "SELECT * FROM ORDER.ITEMSTATE WHERE IST_NR = " + IST_NR + ";";
  //console.log(queryMessage);
  return (queryMessage);
};