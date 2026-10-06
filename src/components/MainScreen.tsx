import ConnectKeyboard from "./ConnectKeyboard";
import EditorLayout from "@/layout/EditorLayout";
import { useKeyboard } from "@/contexts/KeyboardContext";

const MainScreen = () => {
    const { keyboard, isChangingTarget } = useKeyboard();
    return (
        <div className="bg-kb-gray h-screen flex flex-col overflow-auto">
            <main inert={!!keyboard && isChangingTarget} aria-busy={isChangingTarget} className="flex-grow overflow-auto items-center">{!keyboard ? <ConnectKeyboard /> : <EditorLayout />}</main>
        </div>
    );
};

export default MainScreen;
