//******* IMPORTS *******

const mysql = require('mysql2/promise');
var config = require('./config');
const axios = require('axios');


//******* GLOBALS *******

var res;
var message;
var response;
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
  let O_NR = event.O_NR;  //Ordernummer
  let qualityIssueItems = event.body;

  //Fehler schmeißen wenn Body kein Array ist.
  if (!Array.isArray(qualityIssueItems)) {
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
    //Prüfen ob der Auftrag existiert
    await callDBResonse(pool, checkOrderExist(O_NR));
    if(res == null){
      message = 'Der Auftrag' + O_NR + ' wurde nicht gefunden.';
      
      response = {
        statusCode: 404,
        errorMessage: message,
        errorType: "Not Found"
      };
      
      //Fehler schmeisen
      context.fail(JSON.stringify(response));
    }
    else{
      //Status der Order ändern
      await callDB(pool, updateOrderStatus(O_NR, 5));

      //Quality Issues anlegen und den Status der Orderitems ändern
      for (var i = 0; i < qualityIssueItems.length; i++) {

        //Quality Issue anlegen
        await callDB(pool, insertNewQualityIssue(qualityIssueItems[i].QI_O_NR, qualityIssueItems[i].QI_OI_NR, 1, 1, qualityIssueItems[i].QI_QTY, qualityIssueItems[i].QI_COMMENT));

        //Status Orderitem ändern
        await callDB(pool, updateOrderitemStatus(qualityIssueItems[i].QI_O_NR, qualityIssueItems[i].QI_OI_NR, 9));

        //Prüfen, ob Orderitems in MaWi existieren ...
        var available = false;
        if(available){
          //API Call MaWi
        }
        //Neue Produktion auslösen
        else{

          //Order abrufen
          await callDBResonse(pool, getOrder(O_NR));
          var O_TIMESTAMP = res[0].O_TIMESTAMP;
          var C_CT_ID = res[0].C_CT_ID;
          
          //Orderitems abrufen
          await callDBResonse(pool, getOrderOrderitems(O_NR));
          var orderitems = res;
          
          body_production = buildRequestBodyNewOrder(O_NR, C_CT_ID, O_TIMESTAMP, "QS", orderitems);
          
          await postProductionOrder(body_production);
          //console.log(body_production);
        }
      }
 
      var messageJSON = {
        message: 'Die QS wurde erfasst.'
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

//************ Hilfsfunktionen ************

const buildRequestBodyNewOrder = function (O_NR, C_CT_ID, O_TIMESTAMP, PO_CODE, orderitems) {
  var order;
  var body = [];
  var customerType;

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
      res = res.body;
      console.log(res);
      return results;
    })
    .catch((error) => {
      console.error(error);
    }); 
}

//******* SQL Statements *******

const updateOrderitemStatus = function (O_NR, OI_NR, IST_NR) {
  var queryMessage = "UPDATE ORDER.ORDERITEM SET OI_IST_NR = " + IST_NR + " WHERE OI_O_NR = " + O_NR + " AND OI_NR = " + OI_NR + ";";
  //console.log(queryMessage);
  return (queryMessage);
};

const checkOrderExist = function (O_NR) {
  var queryMessage = "SELECT * FROM ORDER.ORDER WHERE O_NR='" + O_NR + "';";
  //console.log(queryMessage);
  return (queryMessage);
};

const updateOrderStatus = function (O_NR, O_OST_NR) {
  var queryMessage = "UPDATE `ORDER`.`ORDER` SET `O_OST_NR` = '" + O_OST_NR + "' WHERE (`O_NR` = '" + O_NR + "');";
  //console.log(queryMessage);
  return (queryMessage);
};

const insertNewQualityIssue = function (QI_O_NR, QI_OI_NR, QI_COUNTER, QI_IST_NR, QI_QTY, QI_COMMENT) {
  var queryMessage = "INSERT INTO `QUALITY`.`QUALITYISSUE` (QI_O_NR, QI_OI_NR, QI_COUNTER, QI_IST_NR, QI_QTY, QI_COMMENT) VALUES ('" + QI_O_NR + "', '" + QI_OI_NR + "', '" + QI_COUNTER + "', '" + QI_IST_NR + "', '" + QI_QTY + "', '" + QI_COMMENT + "');";
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