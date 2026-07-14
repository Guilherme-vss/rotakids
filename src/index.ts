import { criarApp } from "./app";

const PORT = Number(process.env.PORT) || 3000;

criarApp().listen(PORT, () => {
  console.log(`🚐 RotaKids rodando em http://localhost:${PORT}`);
});
