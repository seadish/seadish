// client/src/firebase/classrooms.ts
import { db, isFirebaseConfigured } from './config';
import {
  doc, setDoc, getDoc, serverTimestamp,
  type FieldValue,
} from 'firebase/firestore';

export interface Classroom {
  classCode: string;       // "{schoolCode}-{grade}-{classNumber}"
  schoolCode: string;
  schoolName: string;
  grade: number;
  classNumber: number;
  teacherUid: string;
  teacherName: string;
  createdAt?: FieldValue;
  updatedAt?: FieldValue;
}

export function makeClassCode(schoolCode: string, grade: number, classNumber: number): string {
  return `${schoolCode}-${grade}-${classNumber}`;
}

export async function getClassroom(classCode: string): Promise<Classroom | null> {
  if (!isFirebaseConfigured) return null;
  const snap = await getDoc(doc(db, 'classrooms', classCode));
  if (!snap.exists()) return null;
  return snap.data() as Classroom;
}

export async function createClassroomIfNew(input: {
  schoolCode: string;
  schoolName: string;
  grade: number;
  classNumber: number;
  teacherUid: string;
  teacherName: string;
}): Promise<Classroom | null> {
  if (!isFirebaseConfigured) {
    return { classCode: makeClassCode(input.schoolCode, input.grade, input.classNumber), ...input };
  }
  const classCode = makeClassCode(input.schoolCode, input.grade, input.classNumber);
  const existing = await getClassroom(classCode);
  if (existing) return null;

  const classroom: Classroom = {
    classCode,
    schoolCode: input.schoolCode,
    schoolName: input.schoolName,
    grade: input.grade,
    classNumber: input.classNumber,
    teacherUid: input.teacherUid,
    teacherName: input.teacherName,
  };
  await setDoc(doc(db, 'classrooms', classCode), {
    ...classroom,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return classroom;
}
