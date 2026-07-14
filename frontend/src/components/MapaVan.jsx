import { useEffect } from "react";
import { GeoJSON, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { corDoPonto } from "../api.js";

/** Cria o pino colorido (verde = vai, vermelho = falta) usado no mapa. */
function pinoColorido(cor) {
  return L.divIcon({
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${cor};border:3px solid #fff;box-shadow:0 0 5px rgba(0,0,0,.45)"></div>`,
    className: "",
    iconSize: [18, 18],
  });
}

/** Reenquadra o mapa sempre que os pontos mudarem. */
function Enquadrar({ pontos }) {
  const mapa = useMap();
  useEffect(() => {
    if (pontos.length > 0) {
      mapa.fitBounds(pontos, { padding: [45, 45] });
    }
  }, [pontos, mapa]);
  return null;
}

/**
 * O mapa da van: alunos como pontos coloridos + traçado da rota.
 * Recebe os dados prontos; toda a lógica fica nos painéis.
 */
export default function MapaVan({ alunos, rota }) {
  const comCasa = alunos.filter((a) => a.casa_lat != null);
  const pontos = comCasa.map((a) => [Number(a.casa_lat), Number(a.casa_lng)]);

  // Linha reta de reserva quando o OSRM não devolve o traçado rua a rua
  const linhaReserva =
    rota && !rota.tracado && rota.paradas?.length > 0
      ? [rota.origem, ...rota.paradas.map((p) => [p.lat, p.lng]),
         ...(rota.escola ? [[rota.escola.lat, rota.escola.lng]] : [])]
      : null;

  return (
    <MapContainer center={[-23.5505, -46.6333]} zoom={12} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Enquadrar pontos={pontos} />

      {comCasa.map((aluno) => (
        <Marker
          key={aluno.id}
          position={[Number(aluno.casa_lat), Number(aluno.casa_lng)]}
          icon={pinoColorido(corDoPonto(aluno.vai_hoje))}
        >
          <Popup>
            <strong>{aluno.nome}</strong>
            <br />👤 Responsável: {aluno.responsavel} ({aluno.telefone_responsavel || "sem telefone"})
            {aluno.problema_saude && <><br />🏥 Saúde: {aluno.problema_saude}</>}
            {aluno.contato_emergencia && <><br />🆘 Emergência: {aluno.contato_emergencia}</>}
            {!aluno.vai_hoje && (
              <>
                <br />
                <strong style={{ color: "#dc2626" }}>Falta hoje:</strong>{" "}
                {aluno.justificativa || "sem motivo informado"}
              </>
            )}
          </Popup>
        </Marker>
      ))}

      {rota?.tracado?.geometria && (
        <GeoJSON
          key={JSON.stringify(rota.paradas.map((p) => p.alunoId))}
          data={rota.tracado.geometria}
          style={{ color: "#2563eb", weight: 5 }}
        />
      )}

      {linhaReserva && <Polyline positions={linhaReserva} color="#2563eb" dashArray="8 8" />}
    </MapContainer>
  );
}
