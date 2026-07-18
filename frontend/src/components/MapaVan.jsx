import { useEffect } from "react";
import { GeoJSON, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

/**
 * O mapa do RotaKids.
 *
 * A cor de cada pino vem do DOMÍNIO (`corDoStatus`), não daqui — a tela só
 * desenha o que a regra decidiu. Assim o vermelho da volta ("ainda na van")
 * nunca vira verde por engano numa refatoração de CSS.
 */

/** Pino da criança: o avatar dela dentro de um balão da cor do status. */
function pinoCrianca(cor, avatar) {
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

function pinoVan() {
  return L.divIcon({
    html:
      `<div style="width:38px;height:38px;border-radius:50%;background:#1e3a8a;border:3px solid #fff;` +
      `box-shadow:0 2px 8px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-size:20px">🚐</div>`,
    className: "",
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

/** Reenquadra o mapa quando os pontos mudam. */
function Enquadrar({ pontos }) {
  const mapa = useMap();
  useEffect(() => {
    if (pontos.length > 0) mapa.fitBounds(pontos, { padding: [50, 50] });
  }, [JSON.stringify(pontos), mapa]);
  return null;
}

export default function MapaVan({ alunos = [], escola, posicaoVan, geometria = null, foco = null }) {
  const comCasa = alunos.filter((a) => a.lat != null);
  const pontos = [
    ...comCasa.map((a) => [Number(a.lat), Number(a.lng)]),
    ...(escola?.lat ? [[escola.lat, escola.lng]] : []),
    ...(posicaoVan ? [[posicaoVan.lat, posicaoVan.lng]] : []),
  ];

  return (
    <MapContainer center={[-23.5505, -46.6333]} zoom={12} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {/* 🔌 Camada de trânsito entra aqui quando a chave estiver pronta:
          <TileLayer url="https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=SUA_CHAVE" /> */}

      <Enquadrar pontos={foco ? [foco] : pontos} />

      {comCasa.map((aluno) => (
        <Marker
          key={`${aluno.alunoId}-${aluno.status}`}
          position={[Number(aluno.lat), Number(aluno.lng)]}
          icon={pinoCrianca(aluno.cor, aluno.avatar)}
        >
          <Popup>
            <strong>{aluno.avatar} {aluno.nome}</strong>
            <br />
            <span style={{ color: aluno.cor, fontWeight: 700 }}>{aluno.statusRotulo}</span>
            {aluno.justificativa && <><br />📝 {aluno.justificativa}</>}
            {aluno.embarcadoEm && (
              <><br />🔵 Embarcou às {new Date(aluno.embarcadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</>
            )}
            {aluno.entregueEm && (
              <><br />🟢 Entregue às {new Date(aluno.entregueEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</>
            )}
          </Popup>
        </Marker>
      ))}

      {escola?.lat && (
        <Marker position={[escola.lat, escola.lng]} icon={pinoEscola()}>
          <Popup><strong>🏫 {escola.nome}</strong></Popup>
        </Marker>
      )}

      {posicaoVan && (
        <Marker position={[posicaoVan.lat, posicaoVan.lng]} icon={pinoVan()}>
          <Popup><strong>🚐 A van está aqui</strong></Popup>
        </Marker>
      )}

      {geometria && (
        <GeoJSON
          key={JSON.stringify(geometria.coordinates?.[0] ?? geometria)}
          data={geometria}
          style={{ color: "#2563eb", weight: 5, opacity: 0.85 }}
        />
      )}
    </MapContainer>
  );
}
