import { useEffect } from "react";
import { GeoJSON, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { corDoPonto } from "../api.js";

/**
 * Pino do aluno no mapa: o avatar da criança dentro de um balão
 * verde (vai), vermelho (falta) ou azul (já embarcou na van).
 */
function pinoColorido(cor, avatar) {
  return L.divIcon({
    html:
      `<div style="width:34px;height:34px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);` +
      `background:${cor};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);` +
      `display:flex;align-items:center;justify-content:center">` +
      `<span style="transform:rotate(45deg);font-size:17px">${avatar || "🧒"}</span></div>`,
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 30],
  });
}

/** Pino da escola (destino final). */
function pinoEscola() {
  return L.divIcon({
    html:
      `<div style="width:36px;height:36px;border-radius:10px;background:#7c3aed;border:3px solid #fff;` +
      `box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:19px">🏫</div>`,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 32],
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
 * O mapa da van: alunos como pinos coloridos + a rota escolhida
 * seguindo as RUAS (GeoJSON do OSRM). A linha reta tracejada só
 * aparece como reserva se o serviço de mapas estiver fora do ar.
 */
export default function MapaVan({ alunos, rota, pegos = [], geometria = null }) {
  const comCasa = alunos.filter((a) => a.casa_lat != null);
  const pontos = comCasa.map((a) => [Number(a.casa_lat), Number(a.casa_lng)]);

  const linhaReserva =
    rota && !geometria && rota.paradas?.length > 0
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
          key={`${aluno.id}-${pegos.includes(aluno.id)}`}
          position={[Number(aluno.casa_lat), Number(aluno.casa_lng)]}
          icon={pinoColorido(corDoPonto(aluno.vai_hoje, pegos.includes(aluno.id)), aluno.avatar)}
        >
          <Popup>
            <strong>{aluno.avatar || "🧒"} {aluno.nome}</strong>
            {pegos.includes(aluno.id) && <><br />🔵 <strong>Já está na van!</strong></>}
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

      {rota?.escola && (
        <Marker position={[rota.escola.lat, rota.escola.lng]} icon={pinoEscola()}>
          <Popup><strong>🏫 {rota.escola.nome}</strong><br />Destino final da rota.</Popup>
        </Marker>
      )}

      {/* Rota escolhida, seguindo as ruas (OSRM) */}
      {geometria && (
        <GeoJSON
          key={JSON.stringify(geometria.coordinates?.[0] ?? geometria)}
          data={geometria}
          style={{ color: "#2563eb", weight: 5, opacity: 0.85 }}
        />
      )}

      {linhaReserva && <Polyline positions={linhaReserva} color="#2563eb" dashArray="8 8" />}
    </MapContainer>
  );
}
