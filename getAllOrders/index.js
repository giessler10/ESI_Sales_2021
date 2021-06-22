/*-----------------------------------------------------------------------*/
// Autor: ESI SoSe21 - Team sale & shipping
// University: University of Applied Science Offenburg
// Members: Tobias Gießler, Christoph Werner, Katarina Helbig, Aline Schaub
// Contact: ehelbig@stud.hs-offenburg.de, saline@stud.hs-offenburg.de,
//          cwerner@stud.hs-offenburg.de, tgiessle@stud.hs-offenburg.de
/*-----------------------------------------------------------------------*/

//******* IMPORTS *******

const mysql = require('mysql2/promise');
var config = require('./config');


//******* GLOBALS *******

var res;
var response;
var results = [];
var message;

var C_NR = "";
var O_OST_NR = "";

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

  if (event.C_NR !== undefined) {
    C_NR = event.C_NR;
  }

  if (event.O_OST_NR !== undefined) {
    O_OST_NR = event.O_OST_NR.toString().split(',');
  }

  try {
    if (C_NR == "" && O_OST_NR[0] == "") {
      //get all Orders
      await callDBResonse(pool, getAllOrders());
      results = res;
      //console.log(results);

      const response = {
        statusCode: 200,
        body: results
      };

      console.log(response);
      return response;
    }
    else if (C_NR != "" && O_OST_NR[0] == "") {
      //get all Orders with Customer
      await callDBResonse(pool, getAllOrdersCustomerId(C_NR));
      results = res;
      //console.log(results);

      const response = {
        statusCode: 200,
        body: results
      };

      console.log(response);
      return response;
    }
    else if (C_NR == "" && O_OST_NR[0] != "") {
      if (checkArrayItems(O_OST_NR)) {
        //get all Orders with status
        await callDBResonse(pool, getAllOrdersStatus(O_OST_NR));
        results = res;
        //console.log(results);

        const response = {
          statusCode: 200,
          body: results
        };

        console.log(response);
        return response;
      }
      else {
        message = 'Der Queryparameter status hat einen unerlaubten Wert.';

        response = {
          statusCode: 400,
          errorMessage: message,
          errorType: "Bad Request"
        };

        //Fehler schmeisen
        context.fail(JSON.stringify(response));
      }
    }
    else {
      if (checkArrayItems(O_OST_NR)) {
        //get all Orders with status and CustomerId
        await callDBResonse(pool, getAllOrdersStatusCustomerId(O_OST_NR, C_NR));
        results = res;
        //console.log(results);

        const response = {
          statusCode: 200,
          body: results
        };

        console.log(response);
        return response;
      }
      else {
        message = 'Der Queryparameter status hat einen unerlaubten Wert.';

        response = {
          statusCode: 400,
          errorMessage: message,
          errorType: "Bad Request"
        };

        //Fehler schmeisen
        context.fail(JSON.stringify(response));
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
    .catch();
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
        if (!results.length) {
          //Kein Eintrag in der DB gefunden
          res = [];
        }
        else {
          res = JSON.parse(JSON.stringify(results));
          return results;
        }
      })
    .catch();
}

//************* Hilfsfunktionen *****************************

const checkArrayItems = function (arrayStatus) {
  if (Array.isArray(arrayStatus)) {
    var statusAreNumber = true;
    arrayStatus.forEach(function (item) {
      var itemState = parseInt(item, 10);
      if (isNaN(itemState)) {
        statusAreNumber = false;
      }
    });
    //console.log(statusAreNumber);
    return statusAreNumber;
  }
};

const buildSQLWhereStringStatus = function (O_OST_NR) {
  var where = "";
  if (O_OST_NR.length == 1) {
    where = "WHERE O_OST_NR=" + O_OST_NR[0];
    return where;
  }
  else {
    where = "WHERE O_OST_NR IN (" + O_OST_NR.join(', ') + ")";
    return where;
  }
};

const buildSQLWhereStringStatusCustomerId = function (O_OST_NR, C_NR) {
  var where = "";
  if (O_OST_NR.length == 1) {
    where = "WHERE O_OST_NR=" + O_OST_NR[0] + " AND C_NR=" + C_NR;
    return where;
  }
  else {
    where = "WHERE O_OST_NR IN (" + O_OST_NR.join(', ') + ")" + " AND C_NR=" + C_NR;
    return where;
  }
};


//******* SQL Statements *******

const getAllOrders = function () {
  var queryMessage = "SELECT * FROM VIEWS.ORDERINFO ORDER BY O_NR;";
  //console.log(queryMessage)
  return (queryMessage);
};

const getAllOrdersCustomerId = function (C_NR) {
  var queryMessage = "SELECT * FROM VIEWS.ORDERINFO WHERE C_NR=" + C_NR + " ORDER BY O_NR;";
  //console.log(queryMessage);
  return (queryMessage);
};

const getAllOrdersStatus = function (O_OST_NR) {
  var where = buildSQLWhereStringStatus(O_OST_NR);  //WHERE Statement
  var queryMessage = "SELECT * FROM VIEWS.ORDERINFO " + where + " ORDER BY O_NR;";
  //console.log(queryMessage);
  return (queryMessage);
};

const getAllOrdersStatusCustomerId = function (O_OST_NR, C_NR) {
  var where = buildSQLWhereStringStatusCustomerId(O_OST_NR, C_NR);  //WHERE Statement
  var queryMessage = "SELECT * FROM VIEWS.ORDERINFO " + where + " ORDER BY O_NR;";
  //console.log(queryMessage);
  return (queryMessage);
};