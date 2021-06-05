//******* IMPORTS *******

const mysql = require('mysql2/promise');
var config = require('./config');
const axios = require('axios');


//******* GLOBALS *******

var res;
var message;
var response;
var messageJSON;

var body_production;

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
  let O_NR = event.O_NR;          //OrderNr
  let OST_NR = event.OST_NR;      //OrderState


  try{
    //Prüfen ob die Bestellung existiert
    await callDBResonse(pool, checkOrderExist(O_NR));
    if(res == null){
      message = 'Die Bestellung ' + O_NR + ' wurde nicht gefunden.';
      
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
      await callDBResonse(pool, checkStatusExist(OST_NR));
      if(res == null){
        message = 'Die Status-Nummer '+ OST_NR +' wurde nicht gefunden.';
        
        response = {
          statusCode: 400,
          errorMessage: message,
          errorType: "Bad Request"
        };
        //Fehler schmeisen
        context.fail(JSON.stringify(response));
      }
      else{
        
        if(OST_NR == 1){
          //Aufträge bei der Produktion anlegen ******************************************
        
          //Order abrufen
          await callDBResonse(pool, getOrder(O_NR));
          var O_TIMESTAMP = res[0].O_TIMESTAMP;
          var O_OT_NR = res[0].O_OT_NR;
          var C_CT_ID = res[0].C_CT_ID;
          
          //Orderitems abrufen
          await callDBResonse(pool, getOrderOrderitems(O_NR));
          var orderitems = res;
          
          body_production = buildRequestBodyNewOrder(O_NR, C_CT_ID, O_TIMESTAMP, O_OT_NR, orderitems);
          
          await postProductionOrder(body_production);
          //console.log(body_production);

          if(IsDataBaseOffline(res)){
            message = 'Die Datenbank der Produktion ist offline! Der Auftrag konnte nicht übergeben werden.';
        
            response = {
              statusCode: 500,
              errorMessage: message,
              errorType: "Internal Server Error"
            };
            //Fehler schmeisen
            context.fail(JSON.stringify(response));
          }

          //Order aktualisieren
          await callDB(pool, updateOrderStatus(O_NR,OST_NR));

          //Status Oderitems

          //@Chris: Wie bekommen wir den Status der Orderitems auf 2?
          var sqlQuery = buildSQLString(orderitems, 2);
          await callDB(pool, sqlQuery); //New oder Preproduction
          
          messageJSON = {
            message: 'Der Auftrag '+ O_NR +' wurde an die Produktion übergeben.'
          };
    
          response = {
            statusCode: 200,
            message: JSON.stringify(messageJSON)
          }; 
        }
        else{
          //Order aktualisieren
          await callDB(pool, updateOrderStatus(O_NR,OST_NR));

          //Status Oderitems

          //@Chris: Wie bekommen wir den Status der Orderitems auf 2?
          var sqlQuery = buildSQLString(orderitems, 2);
          await callDB(pool, sqlQuery); //New oder Preproduction

          messageJSON = {
            message: 'Der Status des Auftrags '+ O_NR +' wurde aktualisiert.'
          };
    
          response = {
            statusCode: 200,
            message: JSON.stringify(messageJSON)
          }; 
        }
        
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

//************ Hilfsfunktionen ************

const IsDataBaseOffline = function (res){
  if(res.errorMessage == null) return false; 
  if(res.errorMessage === 'undefined') return false;
  if(res.errorMessage.endsWith("timed out after 3.00 seconds")){
      //console.log("Database is offline (AWS).");
      return true;
  }     
  return false;
}

function buildSQLString(orders, IST_NR) {
  var whereNew;
  
  var queryMessageNew;

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
  }
 
  queryMessageNew = "UPDATE ORDER.ORDERITEM SET OI_IST_NR = " + IST_NR + " " + whereNew + "";

  return queryMessageNew;
}

const buildRequestBodyNewOrder = function (O_NR, C_CT_ID, O_TIMESTAMP, O_OT_NR, orderitems) {
  var order;
  var body = [];
  var customerType;
  var PO_CODE;

  //PO_CODE festlegen
  if(O_OT_NR == 1){
    PO_CODE="P";  //P=Preprocessing
  }
  else{
    PO_CODE="N";  //N=NEW
  }
  
  if(C_CT_ID == "B2C"){
    customerType = "P";
  }
  else{
    customerType = "B";
  }

  for (var i = 0; i < orderitems.length; i++) {
    order = {
      O_NR: O_NR,
      OI_NR: orderitems[i].OI_NR,
      PO_CODE: PO_CODE,
      PO_COUNTER: 1,
      QUANTITY: orderitems[i].OI_QTY,
      CUSTOMER_TYPE: customerType,
      O_DATE: O_TIMESTAMP,
      IMAGE: orderitems[i].IM_FILE,
      HEXCOLOR: orderitems[i].OI_HEXCOLOR
    };
    body.push(order);
  }
  return JSON.stringify(body);
};


//************ API Call Production ************

async function postProductionOrder(body) {
  let parsed;
  //console.log(body);
  
  await axios.post('https://1ygz8xt0rc.execute-api.eu-central-1.amazonaws.com/main/createorder', body)
    .then((results) => {

      parsed = JSON.stringify(results.data);
      console.log(parsed);
      res = JSON.parse(parsed);
      return results;
    })
    .catch((error) => {
      console.error(error);
    });  
}

//******* SQL Statements *******

const updateOrderStatus = function (O_NR, O_OST_NR) {
  var queryMessage = "UPDATE `ORDER`.`ORDER` SET `O_OST_NR` = '" + O_OST_NR + "' WHERE (`O_NR` = '" + O_NR + "');";
  //console.log(queryMessage);
  return (queryMessage);
};

const checkOrderExist= function (O_NR) {
  var queryMessage = "SELECT * FROM VIEWS.ORDERINFO WHERE O_NR=" + O_NR + ";";
  //console.log(queryMessage);
  return (queryMessage);
};

const checkStatusExist= function (OST_NR) {
  var queryMessage = "SELECT * FROM ORDER.ORDERSTATE WHERE OST_NR = " + OST_NR + ";";
  //console.log(queryMessage);
  return (queryMessage);
};

const getOrder= function (O_NR) {
  var queryMessage = "SELECT * FROM VIEWS.ORDERINFO WHERE O_NR=" + O_NR + ";";
  //console.log(queryMessage);
  return (queryMessage);
};

const getOrderOrderitems= function (O_NR) {
  var queryMessage = "SELECT * FROM ORDER.ORDERITEM WHERE OI_O_NR=" + O_NR + ";";
  //console.log(queryMessage);
  return (queryMessage);
};