const { createServer } = require("http"); // Node'un kendi sunucusu
const { Server } = require("socket.io");

// Render'ın verdiği portu al
const PORT = process.env.PORT || 3001;

// 1. Önce HTTP Sunucusu oluştur (Boş bir kutu gibi düşün)
const httpServer = createServer();

// 2. Socket.io'yu bu kutunun içine kur
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Her yerden girişe izin ver
    methods: ["GET", "POST"]
  }
});

console.log(`🚀 NEUROWARS Sunucusu ${PORT} portunda HAZIRLANIYOR...`);

io.on("connection", (socket) => {
    console.log(`✅ Bağlantı: ${socket.id}`);

    socket.on("join_room", (room) => {
        socket.join(room);
        io.in(room).emit("user_joined_alert", { userId: socket.id });
        socket.to(room).emit("request_status_update");
    });

    socket.on("send_attack", (data) => {
        socket.to(data.room).emit("receive_attack", { 
            damage: data.damage, 
            attackerId: socket.id 
        });
    });

    socket.on("broadcast_status", (data) => {
        io.in(data.room).emit("update_player_status", { userId: socket.id, stats: data.stats });
    });

    socket.on("cursor_move", (d) => socket.to(d.room).emit("remote_cursor_move", { userId: socket.id, position: d.position }));
    
    socket.on("disconnecting", () => {
        [...socket.rooms].forEach(room => io.in(room).emit("user_left", { userId: socket.id }));
    });
});

// 3. KUTUYU BAŞLAT (En kritik yer burası: io.listen değil, httpServer.listen)
httpServer.listen(PORT, () => {
    console.log(`🚀 SUNUCU ARTIK CANLI! Port: ${PORT}`);
});