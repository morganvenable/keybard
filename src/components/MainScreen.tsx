import { useNavigation } from "@/App";
import ConnectKeyboard from "./ConnectKeyboard";
import EditorLayout from "@/layout/EditorLayout";
import { useVial } from "@/contexts/VialContext";

const MainScreen = () => {
    const { navigateTo } = useNavigation();
    const { keyboard } = useVial();
    return (
        <div className="bg-kb-gray h-screen flex flex-col overflow-auto">
            <main className="flex-grow overflow-auto items-center">{!keyboard ? <ConnectKeyboard onOpenTrainer={() => navigateTo("trainer")} /> : <EditorLayout />}</main>
        </div>
    );
};

export default MainScreen;
