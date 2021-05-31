//******* IMPORTS *******

const mysql = require('mysql2/promise');
var config = require('./config');
const axios = require('axios');


//******* GLOBALS *******

var res;
var message;
var response;
var body_production;
var OI_O_NR; //Bestellnummer
var C_CT_ID; //Kundentyp
var O_TIMESTAMP; //Zeit
var PO_CODE;

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
  let O_C_NR = event.C_NR;        //Kundennummer
  let O_OT_NR = event.O_OT_NR;    //Bestelltyp 1=internal | 2=external
  let draft = event.draft;
  let orderitems = event.orderitems;
  //let O_OST_NR = event.O_OST_NR; -> Always set fixed value of 1 (Open) for Orderstate
  //let O_TIMESTAMP = event.O_TIMESTAMP; -> Not needed, because MySQL will automatically set the Timestamp when Data was Inserted



  try{
    //Prüfen ob der User existiert
    await callDBResonse(pool, checkUserExist(O_C_NR));
    if(res == null){
      message = 'Der Kunde mit der Kundennummer '+ O_C_NR +' wurde nicht gefunden.';
      
      response = {
        statusCode: 404,
        errorMessage: message,
        errorType: "Not Found"
      };
      
      //Fehler schmeisen
      context.fail(JSON.stringify(response));
    }
    else{
      //Bestelltyp festlegen
      if(O_OT_NR == 1){
        PO_CODE="P";  //P=Preprocessing
      }
      else{
        PO_CODE="N";  //N=NEW
      }
      
      //Bestellung als Enwurf anlegen
      if(draft == true){
        await callDB(pool, insertNewOrder(O_C_NR, O_OT_NR, 9));
        
        //Neue Bestellnummer abfragen
        await callDBResonse(pool, getNewOrderID());
        OI_O_NR = res[0].neworderID;
        
        //Orderitems anlegen
        for (var i = 0; i < orderitems.length; i++) {
          //Prüfen, ob Orderitems in MaWi existieren ...
          await callDB(pool, insertNewOrderitem(OI_O_NR, orderitems[i].OI_NR, 1, orderitems[i].OI_MATERIALDESC, orderitems[i].OI_HEXCOLOR, orderitems[i].OI_QTY, orderitems[i].OI_PRICE, orderitems[i].OI_VAT));
          
          //Bild anlegen
        }
      }
      
      //Bestellung direkt an Produktion weiterleiten
      else{
        await callDB(pool, insertNewOrder(O_C_NR, O_OT_NR, 1));
        
        //Neue Bestellnummer abfragen
        await callDBResonse(pool, getNewOrderID());
        OI_O_NR = res[0].neworderID;
        
        //Orderitems anlegen
        for (var i = 0; i < orderitems.length; i++) {
          //Prüfen, ob Orderitems in MaWi existieren ...

          await callDB(pool, insertNewOrderitem(OI_O_NR, orderitems[i].OI_NR, 2, orderitems[i].OI_MATERIALDESC, orderitems[i].OI_HEXCOLOR, orderitems[i].OI_QTY, orderitems[i].OI_PRICE, orderitems[i].OI_VAT));
          
          //Bild anlegen
        }
        
        
        //Aufträge bei der Produktion anlegen ******************************************
        
        //Neue Bestellnummer abfragen
        await callDBResonse(pool, detectBusiness(O_C_NR));
        C_CT_ID = res[0].C_CT_ID;
        
        //Datum bestimmen
        await callDBResonse(pool, detectTimestamp(OI_O_NR));
        O_TIMESTAMP = res[0].O_TIMESTAMP;
        
        body_production = buildRequestBodyNewOrder(OI_O_NR, C_CT_ID, O_TIMESTAMP, PO_CODE, orderitems);
        await postProductionOrder(body_production);
      }
    }      
    //Neue Bestellnummer abfragen
    await callDBResonse(pool, getNewOrderID());
    message = 'Der neue Auftrag hat die Nummer ' + res[0].neworderID +'.';

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
          res = JSON.parse(JSON.stringify(results));
          return results;
        }
      })
    .catch();
}

//************ Hilfsfunktionen ************

const buildRequestBodyNewOrder = function (OI_O_NR, C_CT_ID, O_TIMESTAMP, PO_CODE, orderitems) {
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
      O_NR: OI_O_NR,
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

const insertNewOrder = function (O_C_NR, O_OT_NR, O_OST_NR) {
  var queryMessage = "INSERT INTO `ORDER`.`ORDER` (O_C_NR, O_OT_NR, O_OST_NR) VALUES ('" + O_C_NR + "', '" + O_OT_NR + "', '" + O_OST_NR +"');";
  //console.log(queryMessage);
  return (queryMessage);
};

const insertNewOrderitem = function (OI_O_NR, OI_NR, OI_IST_NR, OI_MATERIALDESC, OI_HEXCOLOR, OI_QTY, OI_PRICE, OI_VAT) {
  var queryMessage = "INSERT INTO `ORDER`.`ORDERITEM` (OI_O_NR, OI_NR, OI_IST_NR, OI_MATERIALDESC, OI_HEXCOLOR, OI_QTY, OI_PRICE, OI_VAT) VALUES ('" + OI_O_NR + "', '" + OI_NR + "', '" + OI_IST_NR +"', '" + OI_MATERIALDESC +"', '" + OI_HEXCOLOR +"', '" + OI_QTY +"', '" + OI_PRICE +"', '" + OI_VAT +"');";
  //console.log(queryMessage);
  return (queryMessage);
};

const getNewOrderID = function () {
    var queryMessage = "SELECT max(O_NR) as neworderID FROM VIEWS.ORDERINFO;";
    //console.log(queryMessage);
    return (queryMessage);
};

const checkUserExist= function (C_NR) {
  var queryMessage = "SELECT * FROM CUSTOMER.CUSTOMER WHERE C_NR='" + C_NR + "';";
  //console.log(queryMessage);
  return (queryMessage);
};

const detectBusiness = function (C_NR) {
  var queryMessage = "SELECT C_CT_ID FROM CUSTOMER.CUSTOMER WHERE C_NR='" + C_NR + "';";
  //console.log(queryMessage);
  return (queryMessage);
};

const detectTimestamp = function (OI_O_NR) {
  var queryMessage = "SELECT O_TIMESTAMP FROM ORDER.ORDER WHERE O_NR='" + OI_O_NR + "';";
  //console.log(queryMessage);
  return (queryMessage);
};