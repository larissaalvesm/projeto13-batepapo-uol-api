import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import dayjs from 'dayjs';

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

    if (!name || typeof (name) !== "string") {
        return res.sendStatus(422);
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

    if (!to || !text || (type !== "message" && type !== "private_message") || !from) return res.sendStatus(422);

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

// app.delete("/participants/:id", async (req, res) => {
//     const { id } = req.params;
//     try {
//         await db.collection("participants").deleteOne({ _id: new ObjectId(id) })
//         res.status(200).send("Usuário deletado com sucesso")
//     } catch (err) {
//         res.status(500).send(err.message);
//     }
// })


const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));