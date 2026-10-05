import EditorLayout from "@/layout/EditorLayout";

const MainScreen = ({ trainer = false }: { trainer?: boolean }) => (
    <div className="bg-kb-gray h-screen flex flex-col overflow-hidden">
        <EditorLayout trainer={trainer} />
    </div>
);

export default MainScreen;
