import express from 'express';
import cors from 'cors';
import { MongoClient } from "mongodb";
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


app.post("/participants", (req, res) => {
    const { name } = req.body;

    if (!name || typeof (name) !== "string") {
        return res.sendStatus(422);
    }
    const lastStatus = Date.now();
    const newParticipant = { name, lastStatus };
    const time = dayjs(lastStatus).format("HH:mm:ss");
    const newMessage = { from: name, to: "Todos", text: "entra na sala...", type: "status", time: time }

    db.collection("participants").findOne({ name: name })
        .then((data) => {
            if (data) {
                return res.sendStatus(409);
            } else {
                db.collection("participants").insertOne(newParticipant)
                    .then(() => {
                        db.collection("messages").insertOne(newMessage)
                            .then(res.sendStatus(201))
                            .catch(err => res.status(500).send(err.message))
                    })
                    .catch(err => res.status(500).send(err.message))
            }
        })
        .catch(err => res.status(500).send(err.message))
})

const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));