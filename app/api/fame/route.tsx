import {NextResponse} from "next/server";
import {currentUser} from "@clerk/nextjs";
import prismadb from "@/lib/prismadb";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const user = await currentUser();
        const { name, description, instructions, seed, src, categoryId } = body;

        if (!user || !user.id || !user.web3Wallets) {
            return new NextResponse("Unauthorized", {status: 401});
        }

        if (!name || !description || !instructions || !seed || !src || !categoryId) {
            return new NextResponse("Missing required fields", {status: 400});
        }

        const wallet = user.web3Wallets.find(wallet => wallet.id === user.primaryWeb3WalletId);

        const fame = await prismadb.fame.create({
            data: {
                userId: user.id,
                web3Wallet: wallet.web3Wallet,
                name,
                description,
                instructions,
                seed,
                src,
                categoryId,
            }
        });
        return NextResponse.json(fame);
    } catch (error) {
        console.log("FAME_POST", error);
        return new NextResponse("Internal Error", {status: 500});
    }
}