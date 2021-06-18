//******* IMPORTS *******

const mysql = require('mysql2/promise');
var config = require('./config');
const axios = require('axios');

//******* GLOBALS *******

var res;
var message;
var response;
var body_production = [];
var body_production_Parsed;

var body_mawi = [];
var orderitemMaWi = [];
var stored = false;

var new_IR_Counter;
var orderitem;
var order;

var sendNewProduction = false;

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
  let O_NR = event.O_NR;              //Ordernummer
  let itemReturnItems = event.body;
  console.log(itemReturnItems);

  //Fehler schmeißen wenn Body kein Array ist.
  if (!Array.isArray(itemReturnItems)) {
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
      //await callDB(pool, updateOrderStatus(O_NR, 5));   //Änderung durch DB
      
      body_production = [];
      orderitemMaWi = [];

      //Item Return Issue anlegen und den Status des Orderitem ändern
      for (var i = 0; i < itemReturnItems.length; i++) {
        //Status prüfen
        await callDBResonse(pool, getMaxPO_COUNTER_AND_STATE(itemReturnItems[i].IR_O_NR, itemReturnItems[i].IR_OI_NR));
        if(res == null){
          new_IR_Counter = 1;

          //Item Return anlegen
          await callDB(pool, insertNewItemReturn(itemReturnItems[i].IR_O_NR, itemReturnItems[i].IR_OI_NR, new_IR_Counter, itemReturnItems[i].IR_RT_NR, itemReturnItems[i].IR_QTY, itemReturnItems[i].IR_COMMENT, 1, itemReturnItems[i].IR_REPRODUCE));

          //Sleep
          await sleep(100);

          //Status Orderitem ändern
          if(itemReturnItems[i].IR_RT_NR == 1){
            if(itemReturnItems[i].IR_REPRODUCE == 1){
              await callDB(pool, updateOrderitemStatus(itemReturnItems[i].IR_O_NR, itemReturnItems[i].IR_OI_NR, 11));
            }
            else{
              await callDB(pool, updateOrderitemStatus(itemReturnItems[i].IR_O_NR, itemReturnItems[i].IR_OI_NR, 10));
            }
          }
          else{
            if(itemReturnItems[i].IR_REPRODUCE == 1){
              await callDB(pool, updateOrderitemStatus(itemReturnItems[i].IR_O_NR, itemReturnItems[i].IR_OI_NR, 9));
            }
            else{
              await callDB(pool, updateOrderitemStatus(itemReturnItems[i].IR_O_NR, itemReturnItems[i].IR_OI_NR, 10));
            }
          }

          //Wenn Neuproduktion gewünscht ist ...
          if(itemReturnItems[i].IR_REPRODUCE == "1"){
            console.log("Neuproduktion gewünscht");
            sendNewProduction = true;

            //Orderitem abrufen
            await callDBResonse(pool, getOrderOrderitem(O_NR, itemReturnItems[i].IR_OI_NR));
            orderitem = res[0];
            orderitem.OI_QTY = itemReturnItems[i].IR_QTY;

            //Sleep
            await sleep(100);
            
            stored = false;

            //Prüfen, ob Orderitem in MaWi existiert
            body_mawi = buildRequestBodyOrderMaWi(O_NR, "R", orderitem);
            await putOrderAvailability(body_mawi);

            //Sleep
            await sleep(300);
            
            console.log("Stored:");
            console.log(stored);

            if(stored){
              //console.log("Insert Mawi");
              //Wenn verfügbar, dem Array orderitemMaWi hinzufügen
              var currentItemReturn = itemReturnItems[i];
              currentItemReturn.IR_COUNTER = new_IR_Counter;
              orderitemMaWi.push(currentItemReturn);

              //await callDBResonse(pool, updateItemReturnStatus(O_NR, itemReturnItems[i].IR_OI_NR, itemReturnItems[i].IR_COUNTER, 5));
            }
            //Neue Produktion auslösen
            else{
              //console.log("Insert Production");
              order = buildNewOrderObject("R", new_IR_Counter, orderitem);
              body_production.push(order);
            }
          }
        }
        else if(res[0].IR_IST_NR == 8 || res[0].IR_IST_NR == 10){
          new_IR_Counter = res[0].IR_COUNTER + 1;

          //Item Return anlegen
          await callDB(pool, insertNewItemReturn(itemReturnItems[i].IR_O_NR, itemReturnItems[i].IR_OI_NR, new_IR_Counter, itemReturnItems[i].IR_RT_NR, itemReturnItems[i].IR_QTY, itemReturnItems[i].IR_COMMENT, 1, itemReturnItems[i].IR_REPRODUCE));

          //Sleep
          await sleep(100);

          //Status Orderitem ändern
          if(itemReturnItems[i].IR_RT_NR == 1){
            await callDB(pool, updateOrderitemStatus(itemReturnItems[i].IR_O_NR, itemReturnItems[i].IR_OI_NR, 11));
          }
          else{
            await callDB(pool, updateOrderitemStatus(itemReturnItems[i].IR_O_NR, itemReturnItems[i].IR_OI_NR, 9));
          }

          //Wenn Neuproduktion gewünscht ist ...
          if(itemReturnItems[i].IR_REPRODUCE == 1){
            console.log("Neue Produktion");
            sendNewProduction = true;

            await callDBResonse(pool, getOrderOrderitem(O_NR, itemReturnItems[i].IR_OI_NR));
            orderitem = res[0];
            orderitem.OI_QTY = itemReturnItems[i].IR_QTY;
            
            stored = false;

            //Prüfen, ob Orderitem in MaWi existiert
            body_mawi = buildRequestBodyOrderMaWi(O_NR, "R", orderitem);
            await putOrderAvailability(body_mawi);

            //Sleep
            await sleep(300);
            
            console.log("Stored:");
            console.log(stored);

            if(stored){
              //Wenn verfügbar, dem Array orderitemMaWi hinzufügen
              var currentItemReturn = itemReturnItems[i];
              currentItemReturn.IR_COUNTER = new_IR_Counter;
              orderitemMaWi.push(currentItemReturn);

              //await callDBResonse(pool, updateItemReturnStatus(O_NR, itemReturnItems[i].IR_OI_NR, itemReturnItems[i].IR_COUNTER, 5));
            }
            //Neue Produktion auslösen
            else{
              order = buildNewOrderObject("R", new_IR_Counter, orderitem);
              body_production.push(order);
            }
          }
        }
      }

      if(sendNewProduction){
        
        body_production_Parsed = JSON.stringify(body_production);
            
        await postProductionOrder(body_production_Parsed);
        //console.log(body_production_Parsed);

        //Sleep
        await sleep(100);
      }

      //Orderitems die verfügbar waren aktualisieren
      for (var i = 0; i < orderitemMaWi.length; i++) {
        await callDB(pool, updateItemReturnStatus(O_NR, orderitemMaWi[i].IR_OI_NR, orderitemMaWi[i].IR_COUNTER, 6));
      }

      var messageJSON = {
        message: 'Die Retoure / Reklamation wurde erfasst.'
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

//Produktion
const buildNewOrderObject = function (PO_CODE, PO_COUNTER, orderitem) {
  var customerType;

  if(orderitem.C_CT_ID == "B2C"){
    customerType = "P";
  }
  else{
    customerType = "B";
  }
  
  var order = {
      O_NR: orderitem.O_NR,
      OI_NR: orderitem.OI_NR,
      PO_CODE: PO_CODE,
      PO_COUNTER: PO_COUNTER,
      QUANTITY: orderitem.OI_QTY,
      CUSTOMER_TYPE: customerType,
      O_DATE: orderitem.O_TIMESTAMP,
      IMAGE: orderitem.IM_FILE,
      HEXCOLOR: orderitem.OI_HEXCOLOR
  };
  
  return order;
};

//Check if database is offline (AWS)
const IsDataBaseOffline = function (res){

  if(res.data.errorMessage == null) return false; 
  if(res.data.errorMessage === 'undefined') return false;
  if(res.data.errorMessage.endsWith("timed out after 3.00 seconds")){
      alert("Database is offline (AWS).");
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
        stored=false;

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

const updateOrderitemStatus = function (O_NR, OI_NR, IST_NR) {
  var queryMessage = "UPDATE ORDER.ORDERITEM SET OI_IST_NR = " + IST_NR + " WHERE OI_O_NR = " + O_NR + " AND OI_NR = " + OI_NR + ";";
  console.log(queryMessage);
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

const insertNewItemReturn = function (IR_O_NR, IR_OI_NR, IR_COUNTER, IR_RT_NR, IR_QTY, IR_COMMENT, IR_IST_NR, IR_REPRODUCE) {
  var queryMessage = "INSERT INTO `QUALITY`.`ITEMRETURN` (`IR_O_NR`, `IR_OI_NR`, `IR_COUNTER`, `IR_RT_NR`, `IR_QTY`, `IR_COMMENT`, `IR_IST_NR`, `IR_REPRODUCE`) VALUES ('" + IR_O_NR + "', '" + IR_OI_NR + "', '" + IR_COUNTER + "', '" + IR_RT_NR + "', '" + IR_QTY + "', '" + IR_COMMENT + "', '" + IR_IST_NR + "', '" + IR_REPRODUCE + "');";
  //console.log(queryMessage);
  return (queryMessage);
};

const getOrderOrderitem= function (O_NR, OI_NR) {
  var queryMessage = "SELECT O_NR, OI_NR, OI_QTY, C_CT_ID, O_TIMESTAMP, IM_FILE, OI_HEXCOLOR FROM VIEWS.FULLORDER WHERE O_NR = "+ O_NR + " AND OI_NR=" + OI_NR + ";";
  //console.log(queryMessage);
  return (queryMessage);
};

const getMaxPO_COUNTER_AND_STATE= function (IR_O_NR, IR_OI_NR) {
  var queryMessage = "SELECT IR_COUNTER, IR_IST_NR FROM QUALITY.ITEMRETURN WHERE IR_O_NR=" + IR_O_NR + " AND IR_OI_NR=" + IR_OI_NR + " AND IR_COUNTER=(Select max(IR_COUNTER) FROM QUALITY.ITEMRETURN WHERE IR_O_NR=" + IR_O_NR + " AND IR_OI_NR=" + IR_OI_NR + ");";
  //console.log(queryMessage);
  return (queryMessage);
};

const updateItemReturnStatus = function (IR_O_NR, IR_OI_NR, IR_COUNTER, IR_IST_NR) {
  var queryMessage = "UPDATE `QUALITY`.`ITEMRETURN` SET `IR_IST_NR` = '" + IR_IST_NR + "' WHERE (`IR_O_NR` = '"+ IR_O_NR + "') and (`IR_OI_NR` = '" + IR_OI_NR + "') and (`IR_COUNTER` = '" + IR_COUNTER + "');";
  console.log(queryMessage);
  return (queryMessage);
};