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
var orderitemProduce = [];
var body_mawi;
var orderitemMaWi = [];
var stored;

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

          //Sleep
          await sleep(100);
          
          //Orderitems abrufen
          await callDBResonse(pool, getOrderOrderitems(O_NR));
          var orderitems = res;

          //Prüfen, ob Orderitems in MaWi existieren *************************************
          for (var i = 0; i < orderitems.length; i++) {
            //Sleep
            await sleep(100);

            body_mawi = buildRequestBodyOrderMaWi(O_NR, "N", orderitems[i]);
            await putOrderAvailability(body_mawi);
            
            //Sleep
            await sleep(200);

            if(stored){
              //Wenn verfügbar, dem Array orderitemMaWi hinzufügen
              orderitemMaWi.push(orderitems[i]);      
            }
            else{
              //Zu den zu produzierenden Orderitems für die Produktion hinzufügen
              orderitemProduce.push(orderitems[i]);
            }
          }

          if(orderitemProduce.length != 0){
            //Sleep
            await sleep(100);

            body_production = buildRequestBodyNewOrder(O_NR, C_CT_ID, O_TIMESTAMP, O_OT_NR, orderitemProduce);
            
            await postProductionOrder(body_production);
            //console.log(body_production);
          }

          //Sleep
          await sleep(100);

          //Order aktualisieren
          await callDB(pool, updateOrderStatus(O_NR,OST_NR));

          //Orderitems die verfügbar waren aktualisieren
          for (var i = 0; i < orderitemMaWi.length; i++) {
            await callDB(pool, updateOrderitemStatus(O_NR, orderitemMaWi[i].OI_NR, 5));
          }
          
          messageJSON = {
            message: 'Der Auftrag '+ O_NR +' wurde beauftragt.'
          };
    
          response = {
            statusCode: 200,
            message: JSON.stringify(messageJSON)
          }; 
        }
        else{
          //Order aktualisieren
          await callDB(pool, updateOrderStatus(O_NR,OST_NR));

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
const buildRequestBodyOrderMaWi = function (OI_O_NR, PO_CODE, orderitem) {
  var body = [];
  var currentOrder = {
    O_NR: OI_O_NR,
    OI_NR: orderitem.OI_NR,
    PO_CODE: PO_CODE,
    PO_COUNTER: 1,
    QUANTITY: orderitem.OI_QTY,
    HEXCOLOR: orderitem.OI_HEXCOLOR,
    IMAGE: orderitem.IM_FILE
  };
  body.push(currentOrder);
  
  var resonse = {
    body: body
  };
  
  console.log(resonse);
  return JSON.stringify(resonse);
};

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

//Check if database is offline (AWS)
const IsDataBaseOffline = function (res){

  if(res.data.errorMessage == null) return false; 
  if(res.data.errorMessage === 'undefined') return false;
  if(res.data.errorMessage.endsWith("timed out after 3.00 seconds")){
      return true;
  }     
  return false;
};

const sleep = ms => {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
};


//************ API Call Production ************

async function postProductionOrder(body) {
  let parsed;
  //console.log(body);
  
  await axios.post('https://1ygz8xt0rc.execute-api.eu-central-1.amazonaws.com/main/createorder', body)
    .then((results) => {
      
      if(IsDataBaseOffline(results)){  
        response = {
          statusCode: 500,
          errorMessage: "Internal Server Error",
          errorType: "Internal Server Error"
        };
      
        //Fehler schmeisen
        context.fail(JSON.stringify(response));

        return; //Check if db is available
      }

      parsed = JSON.stringify(results.data);
      //console.log(parsed);
      res = JSON.parse(parsed);
      res = res.body;
      return results;
    })
    .catch((error) => {
      console.error(error);
    });  
}

//************ API Call MaWi ************

async function putOrderAvailability(body) {
  let parsed;
  
  await axios.put('https://9j8oo3h3yk.execute-api.eu-central-1.amazonaws.com/Main/putvorproduktion', body)
    .then((results) => {
      
      if(IsDataBaseOffline(results)){
        stored = false;
        
        response = {
          statusCode: 500,
          errorMessage: "Internal Server Error",
          errorType: "Internal Server Error"
        };
      
        //Fehler schmeisen
        context.fail(JSON.stringify(response));

        return; //Check if db is available
      }

      parsed = JSON.stringify(results.data);
      //console.log(parsed);
      res = JSON.parse(parsed);
      stored = res.stored;
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
  var queryMessage = "SELECT OI_O_NR, OI_NR, OI_IST_NR, IST_DESC, OI_MATERIALDESC, OI_HEXCOLOR, OI_QTY, OI_PRICE, OI_VAT, IM_FILE  FROM VIEWS.FULLORDER WHERE OI_O_NR = " + O_NR + " ORDER BY OI_O_NR, OI_NR;";
  //console.log(queryMessage);
  return (queryMessage);
};

const updateOrderitemStatus = function (OI_O_NR, OI_NR, OI_IST_NR) {
  var queryMessage = "UPDATE ORDER.ORDERITEM SET OI_IST_NR = " + OI_IST_NR + " WHERE OI_O_NR = " + OI_O_NR + " AND OI_NR = " + OI_NR + ";";
  //console.log(queryMessage);
  return (queryMessage);
};