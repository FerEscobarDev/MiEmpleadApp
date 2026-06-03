-- CreateTable
CREATE TABLE "Empleador" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Empleada" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empleadorId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaNacimiento" DATETIME NOT NULL,
    "fechaInicioContrato" DATETIME NOT NULL,
    "fechaFinContrato" DATETIME,
    CONSTRAINT "Empleada_empleadorId_fkey" FOREIGN KEY ("empleadorId") REFERENCES "Empleador" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empleadaId" TEXT NOT NULL,
    "salarioBase" INTEGER NOT NULL,
    "diasLaborales" JSONB NOT NULL,
    CONSTRAINT "Configuracion_empleadaId_fkey" FOREIGN KEY ("empleadaId") REFERENCES "Empleada" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EnlaceAcceso" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "empleadaId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "EnlaceAcceso_empleadaId_fkey" FOREIGN KEY ("empleadaId") REFERENCES "Empleada" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemAdicional" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empleadaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "valorUnitario" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ItemAdicional_empleadaId_fkey" FOREIGN KEY ("empleadaId") REFERENCES "Empleada" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Liquidacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empleadaId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "notas" TEXT,
    "salarioBaseCongelado" INTEGER,
    "diasLaboralesCongelado" JSONB,
    "totalCongelado" INTEGER,
    CONSTRAINT "Liquidacion_empleadaId_fkey" FOREIGN KEY ("empleadaId") REFERENCES "Empleada" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Inasistencia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "liquidacionId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL,
    CONSTRAINT "Inasistencia_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "Liquidacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LiquidacionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "liquidacionId" TEXT NOT NULL,
    "itemId" TEXT,
    "nombre" TEXT NOT NULL,
    "valorUnitario" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    CONSTRAINT "LiquidacionItem_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "Liquidacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LiquidacionItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemAdicional" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MontoPuntual" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "liquidacionId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    CONSTRAINT "MontoPuntual_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "Liquidacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MenuConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empleadaId" TEXT NOT NULL,
    "comidas" JSONB NOT NULL,
    "periodicidad" TEXT NOT NULL DEFAULT 'SEMANAL',
    CONSTRAINT "MenuConfig_empleadaId_fkey" FOREIGN KEY ("empleadaId") REFERENCES "Empleada" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MenuEntrada" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "menuConfigId" TEXT NOT NULL,
    "semana" INTEGER NOT NULL,
    "diaSemana" TEXT NOT NULL,
    "comida" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    CONSTRAINT "MenuEntrada_menuConfigId_fkey" FOREIGN KEY ("menuConfigId") REFERENCES "MenuConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RutinaTarea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empleadaId" TEXT NOT NULL,
    "diaSemana" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "horaInicio" TEXT,
    "horaFin" TEXT,
    "orden" INTEGER NOT NULL,
    CONSTRAINT "RutinaTarea_empleadaId_fkey" FOREIGN KEY ("empleadaId") REFERENCES "Empleada" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CumplimientoTarea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rutinaTareaId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL,
    "hecha" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "CumplimientoTarea_rutinaTareaId_fkey" FOREIGN KEY ("rutinaTareaId") REFERENCES "RutinaTarea" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Empleador_email_key" ON "Empleador"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Empleada_empleadorId_key" ON "Empleada"("empleadorId");

-- CreateIndex
CREATE UNIQUE INDEX "Configuracion_empleadaId_key" ON "Configuracion"("empleadaId");

-- CreateIndex
CREATE UNIQUE INDEX "EnlaceAcceso_token_key" ON "EnlaceAcceso"("token");

-- CreateIndex
CREATE UNIQUE INDEX "EnlaceAcceso_empleadaId_key" ON "EnlaceAcceso"("empleadaId");

-- CreateIndex
CREATE UNIQUE INDEX "Liquidacion_empleadaId_anio_mes_key" ON "Liquidacion"("empleadaId", "anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "MenuConfig_empleadaId_key" ON "MenuConfig"("empleadaId");
