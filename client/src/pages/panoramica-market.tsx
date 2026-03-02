import PanoramicaMarket from "@/components/clients/panoramica-market";

export default function PanoramicaMarketPage() {
    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-y-auto w-full">
            <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 lg:p-8 space-y-6">
                <PanoramicaMarket />
            </main>
        </div>
    );
}
