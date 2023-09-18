import prismadb from "@/lib/prismadb";
import {FameForm} from "@/app/(root)/(routes)/fame/[fameId]/components/fame-form";
import {auth, redirectToSignIn} from "@clerk/nextjs";

interface FamePageProps {
    params: {
        fameId: string
    }
}
const FameIdPage = async ({params}: FamePageProps) => {
    const {userId} = auth();

    if (!userId) {
        return redirectToSignIn();
    }

    const fame = await prismadb.fame.findUnique({
        where: {
            id: params.fameId,
            userId,
        }
    });
    const categories = await prismadb.category.findMany();
    return (
        <div>
            <FameForm
                initialData={fame}
                categories={categories}
            />
        </div>
    )
}

export default FameIdPage;