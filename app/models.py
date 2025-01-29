from google.cloud import firestore

db = firestore.Client()

class User:
    @staticmethod
    def create(username, email, password, role):
        users_ref = db.collection('users')
        users_ref.add({
            'username': username,
            'email': email,
            'password': password,
            'role': role
        })

    @staticmethod
    def get_by_email(email):
        users_ref = db.collection('users')
        return next(iter(users_ref.where('email', '==', email).stream()), None)

class Question:
    @staticmethod
    def add(text):
        questions_ref = db.collection('questions')
        questions_ref.add({'text': text})

    @staticmethod
    def get_all():
        questions_ref = db.collection('questions')
        return [{'id': q.id, **q.to_dict()} for q in questions_ref.stream()]

class Response:
    @staticmethod
    def add(user_id, question_id, response_value):
        responses_ref = db.collection('responses')
        responses_ref.add({
            'user_id': user_id,
            'question_id': question_id,
            'response_value': response_value,
            'session_date': firestore.SERVER_TIMESTAMP
        })

    @staticmethod
    def get_by_user(user_id):
        responses_ref = db.collection('responses')
        return [{'id': r.id, **r.to_dict()} for r in responses_ref.where('user_id', '==', user_id).stream()]
