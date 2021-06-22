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

var O_NR;
var res;
var response;
var results = [];

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

  O_NR = event.O_NR;  //Order-Nummer

  try {
    //get all Orderinfo
    await callDBResonse(pool, getOrderitems(O_NR));
    results = res;
    console.log(results);

    const response = {
      statusCode: 200,
      body: results
    };

    console.log(response);
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
        if (!results.length) {
          //Kein Eintrag in der DB gefunden
          res = [];
        }
        else {
          res = JSON.parse(JSON.stringify(results));
          return results;
        }
      })
    .catch(console.log);
}

//******* SQL Statements *******

const getOrderitems = function (O_NR) {
  var queryMessage = "SELECT OI_O_NR, OI_NR, OI_IST_NR, IST_DESC, OI_MATERIALDESC, OI_HEXCOLOR, OI_QTY, OI_PRICE, OI_VAT, IM_FILE  FROM VIEWS.FULLORDER WHERE OI_O_NR = " + O_NR + " ORDER BY OI_O_NR, OI_NR;";
  //console.log(queryMessage)
  return (queryMessage);
};