import { createClient } from '@supabase/supabase-js';

const client = createClient(
  'https://esphlzrzwmzeozjmyvqm.supabase.co',
  'sb_publishable_zzmHc3HfGDfl6cAvgYbO2Q_575YjS0v'
);

async function run() {
  // Sign in as admin
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: 'admin@windfarm.dev',
    password: 'Password123!',
  });
  if (authError) {
    console.error('Auth Error:', authError.message);
    process.exit(1);
  }
  console.log('Signed in as:', authData.user.email);

  // Define serial numbers for all turbines
  const serialData = [
    // Alto de la Degollada (f0000000-0003-4000-8000-000000000003)
    { id: '10000000-0013-4000-8000-000000000013', serial_number: 'NX163-2024-0451', tower_serial_number: 'TWR-NX-2024-0451', anticlockwise: false },
    { id: '10000000-0014-4000-8000-000000000014', serial_number: 'NX163-2024-0452', tower_serial_number: 'TWR-NX-2024-0452', anticlockwise: false },
    { id: '10000000-0015-4000-8000-000000000015', serial_number: 'NX163-2024-0453', tower_serial_number: 'TWR-NX-2024-0453', anticlockwise: true },
    { id: '10000000-0016-4000-8000-000000000016', serial_number: 'NX163-2024-0454', tower_serial_number: 'TWR-NX-2024-0454', anticlockwise: false },
    // Filo de Magocs (f0000000-0001-4000-8000-000000000001)
    { id: '10000000-0001-4000-8000-000000000001', serial_number: 'V150-2022-1001', tower_serial_number: 'TWR-VS-2022-1001', anticlockwise: false },
    { id: '10000000-0002-4000-8000-000000000002', serial_number: 'V150-2022-1002', tower_serial_number: 'TWR-VS-2022-1002', anticlockwise: false },
    { id: '10000000-0003-4000-8000-000000000003', serial_number: 'V150-2022-1003', tower_serial_number: 'TWR-VS-2022-1003', anticlockwise: true },
    { id: '10000000-0004-4000-8000-000000000004', serial_number: 'V150-2022-1004', tower_serial_number: 'TWR-VS-2022-1004', anticlockwise: false },
    { id: '10000000-0005-4000-8000-000000000005', serial_number: 'V150-2022-1005', tower_serial_number: 'TWR-VS-2022-1005', anticlockwise: false },
    { id: '10000000-0006-4000-8000-000000000006', serial_number: 'V150-2022-1006', tower_serial_number: 'TWR-VS-2022-1006', anticlockwise: true },
    { id: '10000000-0007-4000-8000-000000000007', serial_number: 'V150-2022-1007', tower_serial_number: 'TWR-VS-2022-1007', anticlockwise: false },
    // Sierra del Madero (f0000000-0002-4000-8000-000000000002)
    { id: '10000000-0008-4000-8000-000000000008', serial_number: 'SG58-2023-2001', tower_serial_number: 'TWR-SG-2023-2001', anticlockwise: false },
    { id: '10000000-0009-4000-8000-000000000009', serial_number: 'SG58-2023-2002', tower_serial_number: 'TWR-SG-2023-2002', anticlockwise: false },
    { id: '10000000-0010-4000-8000-000000000010', serial_number: 'SG58-2023-2003', tower_serial_number: 'TWR-SG-2023-2003', anticlockwise: false },
    { id: '10000000-0011-4000-8000-000000000011', serial_number: 'SG58-2023-2004', tower_serial_number: 'TWR-SG-2023-2004', anticlockwise: true },
    { id: '10000000-0012-4000-8000-000000000012', serial_number: 'SG58-2023-2005', tower_serial_number: 'TWR-SG-2023-2005', anticlockwise: false },
    // Peña del Cuervo (f0000000-0004-4000-8000-000000000004)
    { id: '10000000-0017-4000-8000-000000000017', serial_number: 'E126-2021-3001', tower_serial_number: 'TWR-EN-2021-3001', anticlockwise: false },
    { id: '10000000-0018-4000-8000-000000000018', serial_number: 'E126-2021-3002', tower_serial_number: 'TWR-EN-2021-3002', anticlockwise: false },
    { id: '10000000-0019-4000-8000-000000000019', serial_number: 'E126-2021-3003', tower_serial_number: 'TWR-EN-2021-3003', anticlockwise: true },
    { id: '10000000-0020-4000-8000-000000000020', serial_number: 'E126-2021-3004', tower_serial_number: 'TWR-EN-2021-3004', anticlockwise: false },
    { id: '10000000-0021-4000-8000-000000000021', serial_number: 'E126-2021-3005', tower_serial_number: 'TWR-EN-2021-3005', anticlockwise: false },
    { id: '10000000-0022-4000-8000-000000000022', serial_number: 'E126-2021-3006', tower_serial_number: 'TWR-EN-2021-3006', anticlockwise: false },
    { id: '10000000-0023-4000-8000-000000000023', serial_number: 'E126-2021-3007', tower_serial_number: 'TWR-EN-2021-3007', anticlockwise: true },
    { id: '10000000-0024-4000-8000-000000000024', serial_number: 'E126-2021-3008', tower_serial_number: 'TWR-EN-2021-3008', anticlockwise: false },
    // Los Llanos de Aridane (f0000000-0005-4000-8000-000000000005)
    { id: '10000000-0025-4000-8000-000000000025', serial_number: 'V236-2024-4001', tower_serial_number: 'TWR-VS-2024-4001', anticlockwise: false },
    { id: '10000000-0026-4000-8000-000000000026', serial_number: 'V236-2024-4002', tower_serial_number: 'TWR-VS-2024-4002', anticlockwise: false },
    { id: '10000000-0027-4000-8000-000000000027', serial_number: 'V236-2024-4003', tower_serial_number: 'TWR-VS-2024-4003', anticlockwise: true },
  ];

  // Update turbine serial numbers
  for (const turbine of serialData) {
    const { error } = await client
      .from('turbine')
      .update({
        serial_number: turbine.serial_number,
        tower_serial_number: turbine.tower_serial_number,
        anticlockwise: turbine.anticlockwise,
      })
      .eq('id', turbine.id);
    if (error) {
      console.error(`Error updating turbine ${turbine.id}:`, error.message);
    }
  }
  console.log(`✓ ${serialData.length} turbines updated with serial numbers`);

  // Now update blade serial numbers
  const bladeSerials = {
    '10000000-0013-4000-8000-000000000013': ['BLD-NX163-A-0451', 'BLD-NX163-B-0451', 'BLD-NX163-C-0451'],
    '10000000-0014-4000-8000-000000000014': ['BLD-NX163-A-0452', 'BLD-NX163-B-0452', 'BLD-NX163-C-0452'],
    '10000000-0015-4000-8000-000000000015': ['BLD-NX163-A-0453', 'BLD-NX163-B-0453', 'BLD-NX163-C-0453'],
    '10000000-0016-4000-8000-000000000016': ['BLD-NX163-A-0454', 'BLD-NX163-B-0454', 'BLD-NX163-C-0454'],
    '10000000-0001-4000-8000-000000000001': ['BLD-V150-A-1001', 'BLD-V150-B-1001', 'BLD-V150-C-1001'],
    '10000000-0002-4000-8000-000000000002': ['BLD-V150-A-1002', 'BLD-V150-B-1002', 'BLD-V150-C-1002'],
    '10000000-0003-4000-8000-000000000003': ['BLD-V150-A-1003', 'BLD-V150-B-1003', 'BLD-V150-C-1003'],
    '10000000-0004-4000-8000-000000000004': ['BLD-V150-A-1004', 'BLD-V150-B-1004', 'BLD-V150-C-1004'],
    '10000000-0005-4000-8000-000000000005': ['BLD-V150-A-1005', 'BLD-V150-B-1005', 'BLD-V150-C-1005'],
    '10000000-0006-4000-8000-000000000006': ['BLD-V150-A-1006', 'BLD-V150-B-1006', 'BLD-V150-C-1006'],
    '10000000-0007-4000-8000-000000000007': ['BLD-V150-A-1007', 'BLD-V150-B-1007', 'BLD-V150-C-1007'],
    '10000000-0008-4000-8000-000000000008': ['BLD-SG58-A-2001', 'BLD-SG58-B-2001', 'BLD-SG58-C-2001'],
    '10000000-0009-4000-8000-000000000009': ['BLD-SG58-A-2002', 'BLD-SG58-B-2002', 'BLD-SG58-C-2002'],
    '10000000-0010-4000-8000-000000000010': ['BLD-SG58-A-2003', 'BLD-SG58-B-2003', 'BLD-SG58-C-2003'],
    '10000000-0011-4000-8000-000000000011': ['BLD-SG58-A-2004', 'BLD-SG58-B-2004', 'BLD-SG58-C-2004'],
    '10000000-0012-4000-8000-000000000012': ['BLD-SG58-A-2005', 'BLD-SG58-B-2005', 'BLD-SG58-C-2005'],
    '10000000-0017-4000-8000-000000000017': ['BLD-E126-A-3001', 'BLD-E126-B-3001', 'BLD-E126-C-3001'],
    '10000000-0018-4000-8000-000000000018': ['BLD-E126-A-3002', 'BLD-E126-B-3002', 'BLD-E126-C-3002'],
    '10000000-0019-4000-8000-000000000019': ['BLD-E126-A-3003', 'BLD-E126-B-3003', 'BLD-E126-C-3003'],
    '10000000-0020-4000-8000-000000000020': ['BLD-E126-A-3004', 'BLD-E126-B-3004', 'BLD-E126-C-3004'],
    '10000000-0021-4000-8000-000000000021': ['BLD-E126-A-3005', 'BLD-E126-B-3005', 'BLD-E126-C-3005'],
    '10000000-0022-4000-8000-000000000022': ['BLD-E126-A-3006', 'BLD-E126-B-3006', 'BLD-E126-C-3006'],
    '10000000-0023-4000-8000-000000000023': ['BLD-E126-A-3007', 'BLD-E126-B-3007', 'BLD-E126-C-3007'],
    '10000000-0024-4000-8000-000000000024': ['BLD-E126-A-3008', 'BLD-E126-B-3008', 'BLD-E126-C-3008'],
    '10000000-0025-4000-8000-000000000025': ['BLD-V236-A-4001', 'BLD-V236-B-4001', 'BLD-V236-C-4001'],
    '10000000-0026-4000-8000-000000000026': ['BLD-V236-A-4002', 'BLD-V236-B-4002', 'BLD-V236-C-4002'],
    '10000000-0027-4000-8000-000000000027': ['BLD-V236-A-4003', 'BLD-V236-B-4003', 'BLD-V236-C-4003'],
  };

  let bladeUpdateCount = 0;
  for (const [turbineId, serials] of Object.entries(bladeSerials)) {
    const { data: blades } = await client
      .from('blade')
      .select('id, position')
      .eq('turbine_id', turbineId)
      .order('position');

    if (blades) {
      for (const blade of blades) {
        const serial = serials[blade.position - 1]; // position is 1-indexed
        if (serial) {
          const { error } = await client
            .from('blade')
            .update({ serial_number: serial })
            .eq('id', blade.id);
          if (error) {
            console.error(`Error updating blade ${blade.id}:`, error.message);
          } else {
            bladeUpdateCount++;
          }
        }
      }
    }
  }
  console.log(`✓ ${bladeUpdateCount} blades updated with serial numbers`);

  // Verify the data for Alto de la Degollada
  const { data: verify } = await client
    .from('turbine')
    .select('name, serial_number, tower_serial_number, anticlockwise, blades:blade(position, serial_number)')
    .eq('wind_farm_id', 'f0000000-0003-4000-8000-000000000003')
    .order('name');
  console.log('\n✓ Verification (Alto de la Degollada):');
  console.log(JSON.stringify(verify, null, 2));
}

run().catch(console.error);
