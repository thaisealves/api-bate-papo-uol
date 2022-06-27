import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import joi from "joi";
import { MongoClient } from "mongodb";
import dayjs from "dayjs";
dotenv.config();
const now = dayjs();
const app = express();

app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URL);
let db;
mongoClient.connect(() => {
  db = mongoClient.db("api-bate-papo-UOL");
});

const participantSchema = joi.object({
  name: joi.string().required(),
  lastStatus: joi.number(),
}); //joi validation to participant
app.post("/participants", async (req, res) => {
  const { name } = req.body;
  const participant = {
    name,
    lastStatus: Date.now(),
  };
  const enteredMessage = {
    from: name,
    to: "Todos",
    text: "entra na sala...",
    type: "status",
    time: now.format("hh:mm:ss"),
  };
  const isValid = participantSchema.validate(participant);
  if (isValid.error) {
    res.sendStatus(422);
    return;
  }
  try {
    const participantName = await db
      .collection("participants")
      .findOne({ name });
    if (participantName) {
      res.sendStatus(409);
    } else {
      await db.collection("participants").insertOne(participant);
      await db.collection("messages").insertOne(enteredMessage);
      res.sendStatus(201);
    }
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("participants").find().toArray();
    res.send(participants);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

app.post("/messages", async (req, res) => {
  const participants = await db.collection("participants").find().toArray(); // to take the participants informations from the db
  const participantsNames = participants.map((value) => value.name); // to get all the participants names to use on the schema

  const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid("message", "private_message"),
    from: joi.string().valid(...participantsNames),
  }); // joi validation to the message

  const from = req.headers.user; // getting user from headers
  const sendMessage = {
    from,
    ...req.body,
  };
  const isValid = messageSchema.validate(sendMessage); //using the schema to validate
  if (isValid.error) {
    res.sendStatus(422);
    return;
  }

  try {
    await db
      .collection("messages")
      .insertOne({ ...sendMessage, time: now.format("hh:mm:ss") });

    res.sendStatus(201);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

app.get("/messages", async (req, res) => {
  const limit = parseInt(req.query.limit);
  const { user } = req.headers;
  const messages = await db.collection("messages").find().toArray();
  const messagesUser = messages.filter(
    (value) => value.to === "Todos" || value.to === user || value.from === user
  ); //filtering if the user has to see the message
  try {
    if (!limit) {
      res.send(messagesUser);
    } else {
      res.send(messagesUser.slice(-limit));
    }
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

app.post("/status", async (req, res) => {
  const { user } = req.headers;
  const participants = await db.collection("participants").find().toArray(); // to take the participants informations from the db
  const participantsNames = participants.map((value) => value.name); // to get all the participants names to use on the schema
  if (!participantsNames.includes(user)) {
    res.sendStatus(404);
    return;
  } else {
    await db.collection("participants").updateOne(
      {
        name: user,
      },
      { $set: { lastStatus: Date.now() } }
    );
    res.sendStatus(200);
  }
});
async function removing() {
  const participants = await db.collection("participants").find().toArray(); // to take the participants informations from the db
  const participantsStatus = participants.map((value) => value.lastStatus); // to get all the participants names to use on the schema
  for (let i = 0; i < participantsStatus.length; i++) {
    if (Date.now() - participantsStatus[i] > 10000) {
      const removed = await db
        .collection("participants")
        .findOne({ lastStatus: participantsStatus[i] });
      console.log(removed.name);
      const removedMessage = {
        from: removed.name,
        to: "Todos",
        text: "sai da sala...",
        type: "status",
        time: now.format("hh:mm:ss"),
      };
      await db.collection("participants").deleteOne({
          lastStatus: participantsStatus[i],
        });
      await db.collection("messages").insertOne(removedMessage);
    }
  }
}
setInterval(removing, 15000);
app.listen(5000);
