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
});

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
app.listen(5000);
