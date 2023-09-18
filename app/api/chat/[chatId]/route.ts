import dotenv from "dotenv";
import { StreamingTextResponse, LangChainStream } from "ai";
import { auth, currentUser } from "@clerk/nextjs";
import { Replicate } from "langchain/llms/replicate";
import { CallbackManager } from "langchain/callbacks";
import { NextResponse } from "next/server";

import { MemoryManager } from "@/lib/memory";
import { rateLimit } from "@/lib/rate-limit";
import prismadb from "@/lib/prismadb";

dotenv.config({ path: `.env` });

export async function POST(
    request: Request,
    { params }: { params: { chatId: string } }
) {
    try {
        const { prompt } = await request.json();
        const user = await currentUser();

        if (!user || !user.web3Wallets || !user.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const identifier = request.url + "-" + user.id;
        const { success } = await rateLimit(identifier);

        if (!success) {
            return new NextResponse("Rate limit exceeded", { status: 429 });
        }

        const fame = await prismadb.fame.update({
            where: {
                id: params.chatId
            },
            data: {
                messages: {
                    create: {
                        content: prompt,
                        role: "user",
                        userId: user.id,
                    },
                },
            }
        });

        if (!fame) {
            return new NextResponse("Fame not found", { status: 404 });
        }

        const name = fame.id;
        const fame_file_name = name + ".txt";

        const fameKey = {
            fameName: name!,
            userId: user.id,
            modelName: "llama2-13b",
        };
        const memoryManager = await MemoryManager.getInstance();

        const records = await memoryManager.readLatestHistory(fameKey);
        if (records.length === 0) {
            await memoryManager.seedChatHistory(fame.seed, "\n\n", fameKey);
        }
        await memoryManager.writeToHistory("User: " + prompt + "\n", fameKey);

        // Query Pinecone

        const recentChatHistory = await memoryManager.readLatestHistory(fameKey);

        // Right now the preamble is included in the similarity search, but that
        // shouldn't be an issue

        const similarDocs = await memoryManager.vectorSearch(
            recentChatHistory,
            fame_file_name
        );

        let relevantHistory = "";
        if (!!similarDocs && similarDocs.length !== 0) {
            relevantHistory = similarDocs.map((doc) => doc.pageContent).join("\n");
        }
        const { handlers } = LangChainStream();
        // Call Replicate for inference
        const model = new Replicate({
            model:
                "a16z-infra/llama-2-13b-chat:df7690f1994d94e96ad9d568eac121aecf50684a0b0963b25a41cc40061269e5",
            input: {
                max_length: 2048,
            },
            apiKey: process.env.REPLICATE_API_TOKEN,
            callbackManager: CallbackManager.fromHandlers(handlers),
        });

        // Turn verbose on for debugging
        model.verbose = true;

        const resp = String(
            await model
                .call(
                    `
        ONLY generate plain sentences without prefix of who is speaking. DO NOT use ${fame.name}: prefix. 

        ${fame.instructions}

        Below are relevant details about ${fame.name}'s past and the conversation you are in.
        ${relevantHistory}


        ${recentChatHistory}\n${fame.name}:`
                )
                .catch(console.error)
        );

        const cleaned = resp.replaceAll(",", "");
        const chunks = cleaned.split("\n");
        const response = chunks[0];

        await memoryManager.writeToHistory("" + response.trim(), fameKey);
        var Readable = require("stream").Readable;

        let s = new Readable();
        s.push(response);
        s.push(null);
        if (response !== undefined && response.length > 1) {
            memoryManager.writeToHistory("" + response.trim(), fameKey);

            await prismadb.fame.update({
                where: {
                    id: params.chatId
                },
                data: {
                    messages: {
                        create: {
                            content: response.trim(),
                            role: "system",
                            userId: user.id,
                        },
                    },
                }
            });
        }

        return new StreamingTextResponse(s);
    } catch (error) {
        return new NextResponse("Internal Error", { status: 500 });
    }
};