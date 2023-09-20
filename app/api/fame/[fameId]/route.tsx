import { auth, currentUser } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";

export async function PATCH(
    req: Request,
    { params }: { params: { fameId: string } }
) {
    try {
        const body = await req.json();
        const user = await currentUser();
        const { src, name, description, instructions, seed, categoryId } = body;

        if (!params.fameId) {
            return new NextResponse("Fame ID required", { status: 400 });
        }

        if (!user || !user.id || !user.web3Wallets) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        if (!src || !name || !description || !instructions || !seed || !categoryId) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        const wallet = user.web3Wallets.find(wallet => wallet.id === user.primaryWeb3WalletId);

        if (!wallet) {
            return new NextResponse("Wallet required", { status: 400 });
        }


        const fame = await prismadb.fame.update({
            where: {
                id: params.fameId,
                userId: user.id,
            },
            data: {
                categoryId,
                userId: user.id,
                web3Wallet: wallet.web3Wallet,
                src,
                name,
                description,
                instructions,
                seed,
            }
        });

        return NextResponse.json(fame);
    } catch (error) {
        console.log("[COMPANION_PATCH]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: { fameId: string } }
) {
    try {
        console.log(params)
        const { userId } = auth();

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const fame = await prismadb.fame.delete({
            where: {
                userId,
                id: params.fameId
            }
        });

        return NextResponse.json(fame);
    } catch (error) {
        console.log("[COMPANION_DELETE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
};