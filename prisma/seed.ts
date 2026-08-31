import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

import { PrismaClient } from '../src/generated/prisma/client'

/**
 * Jeu de données de démonstration.
 *
 * Il monte une association fictive complète — adhérents, cotisations,
 * comptabilité, événements, assemblée générale — afin que chaque écran ait
 * quelque chose de crédible à afficher dès le premier lancement.
 *
 * Le script est idempotent : il efface l'association de démonstration et la
 * recrée, ce qui permet de le rejouer autant de fois que nécessaire.
 */

process.loadEnvFile('.env')

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

const ORG_SLUG = 'harmonie-du-val'
const DEMO_EMAIL = 'demo@germa.fr'
const DEMO_PASSWORD = 'Association2026'

/** Date relative à aujourd'hui, en jours (négatif = passé). */
function days(offset: number): Date {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + offset)
  return d
}

function pick<T>(items: readonly T[], index: number): T {
  return items[index % items.length]!
}

/** Retire les accents pour fabriquer des adresses e-mail valides. */
function ascii(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

async function main() {
  console.log('Nettoyage de l’association de démonstration…')

  // `onDelete: Cascade` sur organizationId propage la suppression à tous les
  // modules ; seuls les comptes utilisateurs sont traités à part.
  await db.organization.deleteMany({ where: { slug: ORG_SLUG } })
  await db.user.deleteMany({ where: { email: { in: [DEMO_EMAIL, 'tresorier@germa.fr'] } } })

  console.log('Création de l’association…')

  const organization = await db.organization.create({
    data: {
      slug: ORG_SLUG,
      name: 'Harmonie du Val',
      legalName: 'Association Harmonie du Val',
      kind: 'ASSOCIATION_1901',
      email: 'contact@harmonie-du-val.fr',
      phone: '01 23 45 67 89',
      website: 'https://harmonie-du-val.fr',
      addressLine1: '12 rue des Tilleuls',
      postalCode: '38000',
      city: 'Grenoble',
      country: 'FR',
      rnaNumber: 'W381002345',
      enabledModules: JSON.stringify({
        members: true,
        finance: true,
        events: true,
        governance: true,
        documents: true,
      }),
      subscription: {
        create: {
          plan: 'PRO',
          status: 'ACTIVE',
          memberLimit: 500,
          currentPeriodStart: days(-20),
          currentPeriodEnd: days(345),
        },
      },
    },
  })

  const orgId = organization.id

  // ── Comptes et rôles ───────────────────────────────────────
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)

  const president = await db.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash,
      firstName: 'Camille',
      lastName: 'Rousseau',
      emailVerified: days(-400),
      memberships: {
        create: { organizationId: orgId, role: 'OWNER', title: 'Présidente', isDefault: true },
      },
    },
  })

  await db.user.create({
    data: {
      email: 'tresorier@germa.fr',
      passwordHash,
      firstName: 'Yann',
      lastName: 'Lemoine',
      emailVerified: days(-300),
      memberships: {
        create: { organizationId: orgId, role: 'TREASURER', title: 'Trésorier' },
      },
    },
  })

  // ── Catégories et barèmes de cotisation ────────────────────
  console.log('Catégories et barèmes…')

  const catActif = await db.memberCategory.create({
    data: { organizationId: orgId, name: 'Membre actif', code: 'ACTIF', color: '#2563eb', position: 1 },
  })
  const catEtudiant = await db.memberCategory.create({
    data: { organizationId: orgId, name: 'Étudiant', code: 'ETUDIANT', color: '#16a34a', position: 2 },
  })
  const catBienfaiteur = await db.memberCategory.create({
    data: { organizationId: orgId, name: 'Bienfaiteur', code: 'BIENFAITEUR', color: '#c026d3', position: 3 },
  })
  const catHonneur = await db.memberCategory.create({
    data: {
      organizationId: orgId,
      name: "Membre d'honneur",
      code: 'HONNEUR',
      color: '#ca8a04',
      hasVotingRight: false,
      position: 4,
    },
  })

  const feeActif = await db.fee.create({
    data: {
      organizationId: orgId,
      name: 'Cotisation annuelle — membre actif',
      amountCents: 12000,
      period: 'ANNUAL',
      categoryId: catActif.id,
      taxDeductible: true,
    },
  })
  const feeEtudiant = await db.fee.create({
    data: {
      organizationId: orgId,
      name: 'Cotisation annuelle — tarif étudiant',
      amountCents: 6000,
      period: 'ANNUAL',
      categoryId: catEtudiant.id,
      taxDeductible: true,
    },
  })
  await db.fee.create({
    data: {
      organizationId: orgId,
      name: 'Cotisation de soutien (montant libre)',
      amountCents: 25000,
      period: 'ANNUAL',
      categoryId: catBienfaiteur.id,
      taxDeductible: true,
      isFreeAmount: true,
    },
  })

  // ── Adhérents ──────────────────────────────────────────────
  console.log('Adhérents…')

  const people = [
    ['Camille', 'Rousseau', 'F'], ['Yann', 'Lemoine', 'M'], ['Amina', 'Diallo', 'F'],
    ['Thomas', 'Bernard', 'M'], ['Léa', 'Marchand', 'F'], ['Hugo', 'Petit', 'M'],
    ['Sofia', 'Ferreira', 'F'], ['Nathan', 'Girard', 'M'], ['Chloé', 'Moreau', 'F'],
    ['Karim', 'Benali', 'M'], ['Manon', 'Dubois', 'F'], ['Lucas', 'Fontaine', 'M'],
    ['Inès', 'Lopez', 'F'], ['Antoine', 'Roy', 'M'], ['Sarah', 'Cohen', 'F'],
    ['Mehdi', 'Haddad', 'M'], ['Julie', 'Perrin', 'F'], ['Paul', 'Chevalier', 'M'],
    ['Nora', 'Kessler', 'F'], ['Victor', 'Da Silva', 'M'], ['Elsa', 'Brunet', 'F'],
    ['Samuel', 'Nguyen', 'M'],
  ] as const

  const cities = ['Grenoble', 'Échirolles', 'Saint-Martin-d’Hères', 'Meylan', 'Fontaine']
  const categories = [catActif, catActif, catActif, catEtudiant, catBienfaiteur, catHonneur]
  const statuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'LAPSED', 'PENDING'] as const

  const members: { id: string; categoryId: string; status: string }[] = []

  for (const [index, [firstName, lastName, gender]] of people.entries()) {
    const category = pick(categories, index)
    const status = pick(statuses, index)

    const member = await db.member.create({
      data: {
        organizationId: orgId,
        memberNumber: `A${String(index + 1).padStart(4, '0')}`,
        kind: 'PERSON',
        status,
        firstName,
        lastName,
        gender,
        email: `${ascii(firstName)}.${ascii(lastName)}@example.fr`,
        mobile: `06 ${String(10 + index).padStart(2, '0')} ${String(20 + index).padStart(2, '0')} ${String(30 + index).padStart(2, '0')} ${String(40 + index).padStart(2, '0')}`,
        addressLine1: `${index + 3} rue de la Fontaine`,
        postalCode: `380${String(10 + (index % 40)).padStart(2, '0')}`,
        city: pick(cities, index),
        categoryId: category.id,
        joinedAt: days(-700 + index * 25),
        acceptsNewsletter: index % 3 !== 0,
        acceptsPhotos: index % 4 !== 0,
        consentAt: days(-700 + index * 25),
        userId: index === 0 ? president.id : undefined,
      },
    })

    members.push({ id: member.id, categoryId: category.id, status })
  }

  // Une personne morale, pour couvrir le cas des adhésions d'organisations
  const memberOrg = await db.member.create({
    data: {
      organizationId: orgId,
      memberNumber: 'A0023',
      kind: 'ORGANIZATION',
      status: 'ACTIVE',
      legalName: 'École de musique du Val',
      email: 'contact@ecole-musique-val.fr',
      addressLine1: '4 place de la Mairie',
      postalCode: '38000',
      city: 'Grenoble',
      categoryId: catBienfaiteur.id,
      joinedAt: days(-500),
    },
  })
  members.push({ id: memberOrg.id, categoryId: catBienfaiteur.id, status: 'ACTIVE' })

  await db.memberSkill.createMany({
    data: [
      { memberId: members[2]!.id, name: 'Comptabilité', level: 'EXPERT' },
      { memberId: members[3]!.id, name: 'Communication', level: 'INTERMEDIATE' },
      { memberId: members[4]!.id, name: 'Permis B', level: 'EXPERT' },
      { memberId: members[5]!.id, name: 'Sonorisation', level: 'INTERMEDIATE' },
    ],
  })

  console.log(`  ${members.length} adhérents créés.`)

  // ── Comptabilité : exercice, plan comptable, banque ────────
  console.log('Comptabilité…')

  const year = new Date().getFullYear()
  const fiscalYear = await db.fiscalYear.create({
    data: {
      organizationId: orgId,
      label: `Exercice ${year}`,
      startDate: new Date(year, 0, 1),
      endDate: new Date(year, 11, 31),
      status: 'OPEN',
    },
  })

  const bankAccount = await db.bankAccount.create({
    data: {
      organizationId: orgId,
      name: 'Compte courant',
      kind: 'CHECKING',
      bankName: 'Crédit Coopératif',
      iban: 'FR7642559000012345678901234',
      openingBalanceCents: 480000,
    },
  })

  await db.bankAccount.create({
    data: { organizationId: orgId, name: 'Caisse', kind: 'CASH', openingBalanceCents: 15000 },
  })

  // Plan comptable associatif simplifié (PCG)
  const accountSpecs = [
    ['512', 'Banque', 'ASSET'],
    ['530', 'Caisse', 'ASSET'],
    ['106', 'Réserves', 'EQUITY'],
    ['401', 'Fournisseurs', 'LIABILITY'],
    ['606', 'Achats non stockés', 'EXPENSE'],
    ['613', 'Locations', 'EXPENSE'],
    ['616', 'Primes d’assurance', 'EXPENSE'],
    ['625', 'Déplacements et réceptions', 'EXPENSE'],
    ['626', 'Frais postaux et télécommunications', 'EXPENSE'],
    ['756', 'Cotisations', 'REVENUE'],
    ['754', 'Dons et legs', 'REVENUE'],
    ['741', 'Subventions d’exploitation', 'REVENUE'],
    ['706', 'Prestations de services', 'REVENUE'],
  ] as const

  const accounts: Record<string, string> = {}
  for (const [number, name, type] of accountSpecs) {
    const account = await db.ledgerAccount.create({
      data: { organizationId: orgId, number, name, type, isSystem: true },
    })
    accounts[number] = account.id
  }

  // ── Cotisations appelées et réglées ────────────────────────
  console.log('Cotisations et règlements…')

  let duesPaid = 0
  for (const [index, member] of members.entries()) {
    const isStudent = member.categoryId === catEtudiant.id
    const fee = isStudent ? feeEtudiant : feeActif
    const amountCents = isStudent ? 6000 : 12000

    // Les membres d'honneur sont exonérés de cotisation
    const exempt = member.categoryId === catHonneur.id
    const paid = !exempt && member.status === 'ACTIVE'

    const due = await db.due.create({
      data: {
        organizationId: orgId,
        memberId: member.id,
        feeId: fee.id,
        label: `Cotisation ${year}`,
        amountCents: exempt ? 0 : amountCents,
        paidCents: paid ? amountCents : 0,
        status: exempt ? 'WAIVED' : paid ? 'PAID' : 'PENDING',
        periodStart: new Date(year, 0, 1),
        periodEnd: new Date(year, 11, 31),
        dueDate: new Date(year, 2, 31),
        remindersSent: member.status === 'LAPSED' ? 2 : 0,
        lastReminderAt: member.status === 'LAPSED' ? days(-20) : null,
      },
    })

    if (paid) {
      duesPaid += amountCents
      await db.payment.create({
        data: {
          organizationId: orgId,
          memberId: member.id,
          dueId: due.id,
          bankAccountId: bankAccount.id,
          amountCents,
          date: days(-260 + index * 8),
          method: pick(['TRANSFER', 'CARD', 'CHECK', 'CASH'] as const, index),
          status: 'COMPLETED',
        },
      })
    }
  }

  console.log(`  ${(duesPaid / 100).toFixed(2)} € de cotisations encaissées.`)

  // Écriture comptable récapitulative des cotisations
  await db.transaction.create({
    data: {
      organizationId: orgId,
      fiscalYearId: fiscalYear.id,
      bankAccountId: bankAccount.id,
      reference: 'ECR-2026-0001',
      label: `Cotisations ${year}`,
      date: days(-200),
      kind: 'INCOME',
      status: 'POSTED',
      totalCents: duesPaid,
      lines: {
        create: [
          { accountId: accounts['512']!, label: 'Encaissement cotisations', debitCents: duesPaid, position: 0 },
          { accountId: accounts['756']!, label: 'Cotisations', creditCents: duesPaid, position: 1 },
        ],
      },
    },
  })

  const expenses = [
    ['ECR-2026-0002', 'Location de la salle Berlioz', 96000, '613', -150],
    ['ECR-2026-0003', 'Assurance responsabilité civile', 42000, '616', -120],
    ['ECR-2026-0004', 'Achat de partitions', 18500, '606', -90],
    ['ECR-2026-0005', 'Affranchissement convocations AG', 7400, '626', -45],
    ['ECR-2026-0006', 'Déplacement concert Annecy', 23000, '625', -30],
  ] as const

  for (const [reference, label, amount, account, dayOffset] of expenses) {
    await db.transaction.create({
      data: {
        organizationId: orgId,
        fiscalYearId: fiscalYear.id,
        bankAccountId: bankAccount.id,
        reference,
        label,
        date: days(dayOffset),
        kind: 'EXPENSE',
        status: 'POSTED',
        totalCents: amount,
        lines: {
          create: [
            { accountId: accounts[account]!, label, debitCents: amount, position: 0 },
            { accountId: accounts['512']!, label: 'Règlement', creditCents: amount, position: 1 },
          ],
        },
      },
    })
  }

  // Subvention municipale
  await db.transaction.create({
    data: {
      organizationId: orgId,
      fiscalYearId: fiscalYear.id,
      bankAccountId: bankAccount.id,
      reference: 'ECR-2026-0007',
      label: 'Subvention municipale de fonctionnement',
      date: days(-110),
      kind: 'INCOME',
      status: 'POSTED',
      totalCents: 250000,
      lines: {
        create: [
          { accountId: accounts['512']!, label: 'Encaissement subvention', debitCents: 250000, position: 0 },
          { accountId: accounts['741']!, label: 'Subvention', creditCents: 250000, position: 1 },
        ],
      },
    },
  })

  // ── Dons et reçus fiscaux ──────────────────────────────────
  console.log('Dons et reçus fiscaux…')

  const donationSpecs = [
    [members[4]!.id, 'Léa Marchand', 15000, -180],
    [members[10]!.id, 'Manon Dubois', 5000, -95],
    [null, 'Donateur anonyme', 30000, -60],
  ] as const

  for (const [index, [memberId, donorName, amountCents, dayOffset]] of donationSpecs.entries()) {
    const payment = await db.payment.create({
      data: {
        organizationId: orgId,
        memberId: memberId ?? undefined,
        bankAccountId: bankAccount.id,
        amountCents,
        date: days(dayOffset),
        method: 'TRANSFER',
        status: 'COMPLETED',
      },
    })

    const donation = await db.donation.create({
      data: {
        organizationId: orgId,
        memberId: memberId ?? undefined,
        paymentId: payment.id,
        donorName,
        amountCents,
        date: days(dayOffset),
        kind: 'MONEY',
        campaign: 'Collecte instruments 2026',
        isAnonymous: memberId === null,
      },
    })

    await db.taxReceipt.create({
      data: {
        organizationId: orgId,
        donationId: donation.id,
        memberId: memberId ?? undefined,
        number: `${year}-${String(index + 1).padStart(4, '0')}`,
        year,
        amountCents,
        issueDate: days(dayOffset + 5),
        recipientName: donorName,
        taxArticle: '200',
        status: 'ISSUED',
      },
    })
  }

  // Les dons doivent aussi exister en comptabilité, sans quoi le compte 754
  // resterait vide et le suivi budgétaire afficherait un réalisé nul.
  const donationTotal = donationSpecs.reduce((sum, [, , amountCents]) => sum + amountCents, 0)

  await db.transaction.create({
    data: {
      organizationId: orgId,
      fiscalYearId: fiscalYear.id,
      bankAccountId: bankAccount.id,
      reference: 'ECR-2026-0008',
      label: 'Dons — collecte instruments',
      date: days(-55),
      kind: 'INCOME',
      status: 'POSTED',
      totalCents: donationTotal,
      lines: {
        create: [
          { accountId: accounts['512']!, label: 'Encaissement des dons', debitCents: donationTotal, position: 0 },
          { accountId: accounts['754']!, label: 'Dons et legs', creditCents: donationTotal, position: 1 },
        ],
      },
    },
  })

  // ── Budget prévisionnel ────────────────────────────────────
  const budget = await db.budget.create({
    data: {
      organizationId: orgId,
      fiscalYearId: fiscalYear.id,
      name: `Budget prévisionnel ${year}`,
      status: 'APPROVED',
    },
  })

  await db.budgetLine.createMany({
    data: [
      { budgetId: budget.id, accountId: accounts['756']!, label: 'Cotisations', plannedCents: 280000, direction: 'REVENUE', position: 0 },
      { budgetId: budget.id, accountId: accounts['741']!, label: 'Subventions', plannedCents: 250000, direction: 'REVENUE', position: 1 },
      { budgetId: budget.id, accountId: accounts['754']!, label: 'Dons', plannedCents: 60000, direction: 'REVENUE', position: 2 },
      { budgetId: budget.id, accountId: accounts['613']!, label: 'Location de salle', plannedCents: 120000, direction: 'EXPENSE', position: 3 },
      { budgetId: budget.id, accountId: accounts['616']!, label: 'Assurances', plannedCents: 45000, direction: 'EXPENSE', position: 4 },
      { budgetId: budget.id, accountId: accounts['606']!, label: 'Partitions et matériel', plannedCents: 90000, direction: 'EXPENSE', position: 5 },
    ],
  })

  // ── Ressources et événements ───────────────────────────────
  console.log('Événements…')

  const salle = await db.resource.create({
    data: {
      organizationId: orgId,
      name: 'Salle de répétition Berlioz',
      kind: 'ROOM',
      location: '12 rue des Tilleuls',
      capacity: 40,
      requiresApproval: true,
    },
  })

  await db.resource.create({
    data: { organizationId: orgId, name: 'Minibus 9 places', kind: 'VEHICLE', capacity: 9 },
  })

  const concert = await db.event.create({
    data: {
      organizationId: orgId,
      slug: 'concert-de-printemps',
      title: 'Concert de printemps',
      description:
        'Notre rendez-vous annuel à l’auditorium, avec la participation des élèves de l’école de musique.',
      kind: 'FUNDRAISER',
      status: 'PUBLISHED',
      startAt: days(21),
      endAt: days(21),
      locationName: 'Auditorium municipal',
      locationAddress: '2 esplanade Mistral, 38000 Grenoble',
      capacity: 200,
      membersOnly: false,
      registrationClosesAt: days(19),
    },
  })

  const plein = await db.ticketType.create({
    data: { organizationId: orgId, eventId: concert.id, name: 'Plein tarif', priceCents: 1200, position: 0 },
  })
  const reduit = await db.ticketType.create({
    data: {
      organizationId: orgId,
      eventId: concert.id,
      name: 'Tarif adhérent',
      priceCents: 800,
      categoryId: catActif.id,
      position: 1,
    },
  })
  await db.ticketType.create({
    data: { organizationId: orgId, eventId: concert.id, name: 'Moins de 12 ans', priceCents: 0, position: 2 },
  })

  const repetition = await db.event.create({
    data: {
      organizationId: orgId,
      slug: 'repetition-generale',
      title: 'Répétition générale',
      kind: 'ACTIVITY',
      status: 'PUBLISHED',
      startAt: days(14),
      endAt: days(14),
      locationName: 'Salle Berlioz',
      capacity: 40,
      membersOnly: true,
    },
  })

  await db.event.create({
    data: {
      organizationId: orgId,
      slug: 'stage-dete',
      title: 'Stage d’été',
      kind: 'TRAINING',
      status: 'DRAFT',
      startAt: days(95),
      endAt: days(99),
      locationName: 'Salle Berlioz',
      capacity: 25,
      membersOnly: true,
    },
  })

  await db.resourceBooking.create({
    data: {
      organizationId: orgId,
      resourceId: salle.id,
      eventId: repetition.id,
      title: 'Répétition générale',
      startAt: days(14),
      endAt: days(14),
      status: 'APPROVED',
    },
  })

  for (const [index, member] of members.slice(0, 16).entries()) {
    await db.registration.create({
      data: {
        organizationId: orgId,
        eventId: concert.id,
        memberId: member.id,
        ticketTypeId: index % 2 === 0 ? plein.id : reduit.id,
        status: index < 13 ? 'CONFIRMED' : 'PENDING',
        quantity: 1 + (index % 3),
        amountCents: (index % 2 === 0 ? 1200 : 800) * (1 + (index % 3)),
        paidCents: index < 10 ? (index % 2 === 0 ? 1200 : 800) * (1 + (index % 3)) : 0,
        ticketCode: `CDP-${String(index + 1).padStart(4, '0')}`,
      },
    })
  }

  for (const member of members.slice(0, 11)) {
    await db.registration.create({
      data: {
        organizationId: orgId,
        eventId: repetition.id,
        memberId: member.id,
        status: 'CONFIRMED',
      },
    })
  }

  // ── Gouvernance : AG, résolutions, votes ───────────────────
  console.log('Gouvernance…')

  const votingMembers = members.filter((m) => m.categoryId !== catHonneur.id)

  const ag = await db.meeting.create({
    data: {
      organizationId: orgId,
      title: `Assemblée générale ordinaire ${year}`,
      kind: 'AGO',
      status: 'HELD',
      startAt: days(-35),
      endAt: days(-35),
      locationName: 'Salle Berlioz',
      agenda: [
        "1. Rapport moral de la présidente",
        '2. Rapport financier du trésorier',
        '3. Approbation des comptes de l’exercice écoulé',
        '4. Budget prévisionnel',
        '5. Renouvellement du conseil d’administration',
        '6. Questions diverses',
      ].join('\n'),
      quorumBps: 3300,
      convenedAt: days(-56),
      minutes:
        'L’assemblée générale ordinaire s’est tenue en salle Berlioz. Le quorum étant atteint, la présidente a ouvert la séance à 18 h 30.',
      minutesApprovedAt: days(-28),
    },
  })

  let presentCount = 0
  let proxyCount = 0

  for (const [index, member] of votingMembers.entries()) {
    // 60 % présents, 20 % représentés, le reste absent ou excusé
    const bucket = index % 10
    const status =
      bucket < 6 ? 'PRESENT' : bucket < 8 ? 'REPRESENTED' : bucket === 8 ? 'EXCUSED' : 'ABSENT'

    if (status === 'PRESENT') presentCount += 1
    if (status === 'REPRESENTED') proxyCount += 1

    await db.meetingAttendee.create({
      data: {
        meetingId: ag.id,
        memberId: member.id,
        status,
        // Le pouvoir est donné au premier membre présent
        proxyToMemberId: status === 'REPRESENTED' ? votingMembers[0]!.id : null,
        checkedInAt: status === 'PRESENT' ? days(-35) : null,
      },
    })
  }

  await db.meeting.update({
    where: { id: ag.id },
    data: {
      presentCount,
      proxyCount,
      votingBase: votingMembers.length,
      quorumMet: (presentCount + proxyCount) * 10000 >= votingMembers.length * 3300,
    },
  })

  const resolutionSpecs = [
    ['Approbation du rapport moral', 'SIMPLE'],
    ['Approbation des comptes de l’exercice', 'SIMPLE'],
    ['Affectation du résultat en réserves', 'ABSOLUTE'],
    ['Modification de l’article 7 des statuts', 'TWO_THIRDS'],
  ] as const

  const voters = votingMembers.filter((_, i) => i % 10 < 8)

  for (const [index, [title, majorityRule]] of resolutionSpecs.entries()) {
    const resolution = await db.resolution.create({
      data: {
        organizationId: orgId,
        meetingId: ag.id,
        number: index + 1,
        title,
        majorityRule,
        status: 'CLOSED',
        isSecret: index === 3,
        position: index,
      },
    })

    let forCount = 0
    let againstCount = 0
    let abstainCount = 0

    for (const [voterIndex, voter] of voters.entries()) {
      // La résolution statutaire suscite plus d'opposition que les autres
      const contested = index === 3
      const mod = (voterIndex + index) % 10
      const choice = mod < (contested ? 7 : 9) ? 'FOR' : mod < (contested ? 9 : 10) ? 'AGAINST' : 'ABSTAIN'

      if (choice === 'FOR') forCount += 1
      else if (choice === 'AGAINST') againstCount += 1
      else abstainCount += 1

      await db.vote.create({
        data: { resolutionId: resolution.id, memberId: voter.id, choice, castAt: days(-35) },
      })
    }

    const expressed = forCount + againstCount
    const threshold = majorityRule === 'TWO_THIRDS' ? 2 / 3 : 0.5
    await db.resolution.update({
      where: { id: resolution.id },
      data: {
        forCount,
        againstCount,
        abstainCount,
        status: expressed > 0 && forCount / expressed > threshold ? 'ADOPTED' : 'REJECTED',
      },
    })
  }

  // Prochaine réunion de bureau
  await db.meeting.create({
    data: {
      organizationId: orgId,
      title: 'Réunion de bureau',
      kind: 'OFFICE',
      status: 'SCHEDULED',
      startAt: days(10),
      locationName: 'Salle Berlioz',
      agenda: '1. Préparation du concert de printemps\n2. Point de trésorerie\n3. Questions diverses',
    },
  })

  // ── Mandats du bureau ──────────────────────────────────────
  const mandateSpecs = [
    [members[0]!.id, 'PRESIDENT', true],
    [members[1]!.id, 'TREASURER', true],
    [members[2]!.id, 'SECRETARY', false],
    [members[3]!.id, 'VICE_PRESIDENT', false],
    [members[5]!.id, 'BOARD_MEMBER', false],
    [members[8]!.id, 'BOARD_MEMBER', false],
  ] as const

  for (const [memberId, role, hasBankSignature] of mandateSpecs) {
    await db.mandate.create({
      data: {
        organizationId: orgId,
        memberId,
        role,
        startDate: days(-400),
        endDate: days(330),
        electedAtMeetingId: ag.id,
        hasBankSignature,
      },
    })
  }

  // ── Documents ──────────────────────────────────────────────
  console.log('Documents…')

  const folderStatuts = await db.documentFolder.create({
    data: { organizationId: orgId, name: 'Statuts et règlement', isSystem: true, position: 0 },
  })
  const folderPv = await db.documentFolder.create({
    data: { organizationId: orgId, name: 'Procès-verbaux', isSystem: true, position: 1 },
  })
  const folderCompta = await db.documentFolder.create({
    data: { organizationId: orgId, name: 'Comptabilité', isSystem: true, position: 2 },
  })

  await db.document.createMany({
    data: [
      {
        organizationId: orgId,
        folderId: folderStatuts.id,
        name: 'Statuts de l’association',
        kind: 'STATUTES',
        fileUrl: '/documents/statuts.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 184320,
        visibility: 'MEMBERS',
      },
      {
        organizationId: orgId,
        folderId: folderStatuts.id,
        name: 'Règlement intérieur',
        kind: 'BYLAWS',
        fileUrl: '/documents/reglement-interieur.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 96000,
        visibility: 'MEMBERS',
      },
      {
        organizationId: orgId,
        folderId: folderPv.id,
        meetingId: ag.id,
        name: `Procès-verbal AGO ${year}`,
        kind: 'MINUTES',
        fileUrl: '/documents/pv-ago.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 128000,
        visibility: 'MEMBERS',
      },
      {
        organizationId: orgId,
        folderId: folderCompta.id,
        name: 'Attestation d’assurance',
        kind: 'INSURANCE',
        fileUrl: '/documents/assurance.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 74000,
        visibility: 'PRIVATE',
        expiresAt: days(75),
      },
    ],
  })

  console.log('')
  console.log('Jeu de démonstration prêt.')
  console.log(`  Association : ${organization.name}  (/${ORG_SLUG})`)
  console.log(`  Connexion   : ${DEMO_EMAIL}`)
  console.log(`  Mot de passe: ${DEMO_PASSWORD}`)
  console.log('  Second compte (trésorier) : tresorier@germa.fr — même mot de passe')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
