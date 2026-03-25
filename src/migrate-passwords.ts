import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

/**
 * Script para migrar contraseñas existentes de texto plano a bcrypt
 * 
 * IMPORTANTE: Este script solo debe ejecutarse UNA VEZ si tienes usuarios
 * con contraseñas en texto plano en tu base de datos.
 * 
 * Uso:
 * 1. Asegúrate de tener un backup de tu base de datos
 * 2. Ejecuta: npm run build
 * 3. Ejecuta: node dist/migrate-passwords
 */

async function migratePasswords() {
  console.log('🔐 Iniciando migración de contraseñas...');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    // Obtener todos los usuarios
    const users = await dataSource.query(
      'SELECT ID_USUARIO, EMAIL, CONTRASENA FROM USUARIOS'
    );

    console.log(`📊 Se encontraron ${users.length} usuarios`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      const userId = user.ID_USUARIO;
      const email = user.EMAIL;
      const plainPassword = user.CONTRASENA;

      // Verificar si la contraseña ya está hasheada (bcrypt hash comienza con $2)
      if (plainPassword?.startsWith('$2')) {
        console.log(`⏭️  Usuario ${email} ya tiene contraseña cifrada, omitiendo...`);
        skippedCount++;
        continue;
      }

      // Cifrar la contraseña
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      // Actualizar en la base de datos
      await dataSource.query(
        'UPDATE USUARIOS SET CONTRASENA = :1 WHERE ID_USUARIO = :2',
        [hashedPassword, userId]
      );

      console.log(`✅ Usuario ${email} migrado exitosamente`);
      migratedCount++;
    }

    console.log('\n📈 Resumen de migración:');
    console.log(`   ✅ Migrados: ${migratedCount}`);
    console.log(`   ⏭️  Omitidos (ya cifrados): ${skippedCount}`);
    console.log(`   📊 Total: ${users.length}`);
    console.log('\n✨ ¡Migración completada exitosamente!');

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  } finally {
    await app.close();
  }
}

// Ejecutar la migración
(async () => {
  try {
    await migratePasswords();
    console.log('🎉 Proceso finalizado');
    process.exit(0);
  } catch (error) {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  }

})();