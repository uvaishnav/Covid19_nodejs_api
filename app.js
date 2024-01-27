const express = require("express");

const app = express();

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("app listening at server 3000");
    });
  } catch (e) {
    console.log(`DB Error : ${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

app.use(express.json());

// API 1 Login

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  selectUserQuery = `
    select * from user where username = '${username}';`;

  let dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "secret_token");
      response.send(jwtToken);
    }
  }
});

const userLoginStatus = (request, response, next) => {
  const authHeader = request.headers["authorization"];

  let jwtToken;

  if (authHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwtToken = authHeader.split(" ")[1];
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "secret_token", (error, user) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          request.username = user.username;
          next();
        }
      });
    }
  }
};

// API 2

app.get("/states/", userLoginStatus, async (request, response) => {
  const selectAllStatesQuery = `
    select state_id as stateId,
    state_name as stateName,
    population from state;`;

  let statesList = await db.all(selectAllStatesQuery);
  response.send(statesList);
});

// API 3

app.get("/states/:stateId/", userLoginStatus, async (request, response) => {
  let { stateId } = request.params;

  const selectReqState = `
    select state_id as stateId,
    state_name as stateName,
    population from state 
    where state_id = ${stateId};`;

  let reqState = await db.get(selectReqState);
  response.send(reqState);
});

// API 4

app.post("/districts/", userLoginStatus, async (request, response) => {
  let { districtName, stateId, cases, cured, active, deaths } = request.body;

  const addDistrictQuery = `
    insert into district(district_name, state_id, cases, cured, active, deaths)
    values(
        '${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths}
    );`;

  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

// API 5

app.get(
  "/districts/:districtId/",
  userLoginStatus,
  async (request, response) => {
    let { districtId } = request.params;
    const selectReqDistrict = `
    select district_id as districtId,
    district_name as districtName,
    state_id as stateId,
    cases,
    cured,
    active,
    deaths from district
    where district_id = ${districtId};`;

    let reqDistrict = await db.get(selectReqDistrict);
    response.send(reqDistrict);
  }
);

// API 6

app.delete(
  "/districts/:districtId/",
  userLoginStatus,
  async (request, response) => {
    let { districtId } = request.params;

    deleteDistrictQuery = `
    delete from district where district_id = ${districtId};`;

    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// API 7

app.put(
  "/districts/:districtId/",
  userLoginStatus,
  async (request, response) => {
    let { districtId } = request.params;
    let { districtName, stateId, cases, cured, active, deaths } = request.body;
    const updateDetailsQuery = `
    update district set
    district_name  = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    where district_id = ${districtId};`;

    await db.run(updateDetailsQuery);
    response.send("District Details Updated");
  }
);

// API 8

app.get(
  "/states/:stateId/stats/",
  userLoginStatus,
  async (request, response) => {
    const { stateId } = request.params;

    getStatsQuery = `
    select sum(cases) as totalCases,
    sum(cured) as totalCured,
    sum(active) as totalActive,
    sum(deaths) as totalDeaths
    from district where state_id = ${stateId};`;

    let reqStats = await db.get(getStatsQuery);
    response.send(reqStats);
  }
);

module.exports = app;
