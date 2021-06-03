//******* IMPORTS *******

const mysql = require('mysql2/promise');
var config = require('./config');
const axios = require('axios');

//******* GLOBALS *******

var res;
var message;
var response;
var body_production = [];
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
  let O_NR = event.O_NR;  //Ordernummer
  let itemReturnItems = event.body;

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

      //Item Return Issues anlegen und den Status der Orderitems ändern
      for (var i = 0; i < itemReturnItems.length; i++) {

        //Item Return anlegen
        await callDB(pool, insertNewItemReturn(itemReturnItems[i].IR_O_NR, itemReturnItems[i].IR_OI_NR, itemReturnItems[i].IR_RT_NR, itemReturnItems[i].IR_QTY, itemReturnItems[i].IR_COMMENT, itemReturnItems[i].IR_IST_NR, itemReturnItems[i].IR_REPRODUCE));

        //Status Orderitem ändern
        if(itemReturnItems[i].IR_RT_NR == 1){
          await callDB(pool, updateOrderitemStatus(itemReturnItems[i].IR_O_NR, itemReturnItems[i].IR_OI_NR, 11));
        }
        else{
          await callDB(pool, updateOrderitemStatus(itemReturnItems[i].IR_O_NR, itemReturnItems[i].IR_OI_NR, 9));
        }

        //Wenn Neuproduktion gewünscht ist ...
        if(itemReturnItems[i].NewProduction == 1){
          sendNewProduction = true;

          //Prüfen, ob Orderitems in MaWi existieren ...

          var available = false;
          if(available){
            //API Call MaWi
          }
          //Neue Produktion auslösen
          else{
            //Get PO_COUNTER
            await callDBResonse(pool, getMaxPO_COUNTER(O_NR, itemReturnItems[i].QI_OI_NR));
            var PO_COUNTER = res[0].IR_COUNTER;

            //Orderitems abrufen
            await callDBResonse(pool, getOrderOrderitem(O_NR, itemReturnItems[i].QI_OI_NR));
            var orderitem = res[0];
            
            var order = buildNewOrderObject("R", PO_COUNTER, orderitem);
            
            body_production.push(order);
          }
        }
      }

      if(sendNewProduction){

        body_production = JSON.stringify(body_production);
            
        await postProductionOrder(body_production);
        //console.log(body_production);
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

const insertNewItemReturn = function (IR_O_NR, IR_OI_NR, IR_RT_NR, IR_QTY, IR_COMMENT, IR_IST_NR, IR_REPRODUCE) {
  var queryMessage = "INSERT INTO `QUALITY`.`ITEMRETURN` (`IR_O_NR`, `IR_OI_NR`, `IR_RT_NR`, `IR_QTY`, `IR_COMMENT`, `IR_IST_NR`, `IR_REPRODUCE`) VALUES ('" + IR_O_NR + "', '" + IR_OI_NR + "', '" + IR_RT_NR + "', '" + IR_QTY + "', '" + IR_COMMENT + "', '" + IR_IST_NR + "', '" + IR_REPRODUCE + "');";
  //console.log(queryMessage);
  return (queryMessage);
};

const getOrderOrderitem= function (O_NR, OI_NR) {
  var queryMessage = "SELECT O_NR, OI_NR, OI_QTY, C_CT_ID, O_TIMESTAMP, IM_FILE, OI_HEXCOLOR FROM VIEWS.FULLORDER WHERE O_NR = "+ O_NR + " AND OI_NR=" + OI_NR + ";";
  console.log(queryMessage);
  return (queryMessage);
};

const getMaxPO_COUNTER= function (O_NR, OI_NR) {
  var queryMessage = "SELECT max(IR_COUNTER) as IR_COUNTER FROM QUALITY.ITEMRETURN WHERE IR_O_NR=" + O_NR + " AND IR_OI_NR=" + OI_NR + ";";
  //console.log(queryMessage);
  return (queryMessage);
};