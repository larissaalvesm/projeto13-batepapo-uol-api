import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import dayjs from 'dayjs';
import joi from "joi";

const app = express();
app.use(cors());
app.use(express.json());
dotenv.config();

const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;
mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch((err) => console.log(err.message));


app.post("/participants", async (req, res) => {
    const { name } = req.body;

    // if (!name || typeof (name) !== "string") {
    //     return res.sendStatus(422);
    // }

    const participantSchema = joi.object({
        name: joi.string().required()
    })
    const validation = participantSchema.validate({ name }, { abortEarly: false });
    if (validation.error) {
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }

    const lastStatus = Date.now();
    const newParticipant = { name, lastStatus };
    const time = dayjs(lastStatus).format("HH:mm:ss");
    const newMessage = { from: name, to: "Todos", text: "entra na sala...", type: "status", time: time }

    try {
        const participant = await db.collection("participants").findOne({ name: name });
        if (participant) {
            return res.sendStatus(409);
        } else {
            await db.collection("participants").insertOne(newParticipant);
            await db.collection("messages").insertOne(newMessage);
            res.sendStatus(201);
        }

    } catch (err) {
        res.status(500).send(err.message);
    }
})

app.get("/participants", async (req, res) => {

    try {
        const participants = await db.collection("participants").find().toArray();
        res.send(participants);
    } catch (err) {
        res.status(500).send(err.message);
    }
})

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body;
    const from = req.headers.user;
    const messageSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid("message", "private_message").required(),
    });
    const validationMessage = messageSchema.validate({ to, text, type }, { abortEarly: false });
    const fromSchema = joi.object({
        from: joi.required()
    });
    const validationFrom = fromSchema.validate({ from }, { abortEarly: false });
    if (validationMessage.error || validationFrom.error) {
        return res.sendStatus(422);
    }

    // if (!to || !text || (type !== "message" && type !== "private_message") || !from) {
    //     return res.sendStatus(422);
    // }

    try {
        const participant = await db.collection("participants").findOne({ name: from });
        if (!participant) {
            return res.sendStatus(422);
        } else {
            const time = dayjs(Date.now()).format("HH:mm:ss");
            const newMessage = { from, to, text, type, time }
            await db.collection("messages").insertOne(newMessage);
            res.sendStatus(201);
        }
    } catch (err) {
        res.status(500).send(err.message);
    }
})

app.get("/messages", async (req, res) => {
    const participant = req.headers.user;
    const limit = req.query.limit;
    const numberLimit = Number(limit);

    try {
        const messages = await db.collection("messages").find({ $or: [{ to: "Todos" }, { to: participant }, { from: participant }] }).toArray();
        if (!limit) {
            return res.send(messages);
        } else if (numberLimit <= 0 || isNaN(numberLimit) === true) {
            return res.sendStatus(422);
        } else if (limit > 0) {
            const lastMessages = messages.slice(-limit);
            return res.send(lastMessages);
        }
    } catch (err) {
        res.status(500).send(err.message);
    }
})

app.post("/status", async (req, res) => {
    const participant = req.headers.user;

    if (!participant) return res.sendStatus(404);

    try {
        const participantOn = await db.collection("participants").findOne({ name: participant });
        if (!participantOn) {
            return res.sendStatus(404);
        } else {
            const lastStatus = Date.now();
            const editedParticipant = { name: participant, lastStatus: lastStatus };
            await db.collection("participants").updateOne({ name: participant }, { $set: editedParticipant });
            res.sendStatus(200);
        }
    } catch (err) {
        res.status(500).send(err.message);
    }
})

setInterval(async () => {
    const timeToDelete = Date.now() - 10000;
    const participantsToDelete = await db.collection("participants").find({ lastStatus: { $lt: timeToDelete } }).toArray();

    participantsToDelete.map(async (p) => {
        const time = dayjs(Date.now()).format("HH:mm:ss");
        const exitMessage = {
            from: p.name,
            to: 'Todos',
            text: 'sai da sala...',
            type: 'status',
            time
        };
        await db.collection("messages").insertOne(exitMessage);
        await db.collection("participants").deleteOne({ name: p.name });
    })
}, 15000)

const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));