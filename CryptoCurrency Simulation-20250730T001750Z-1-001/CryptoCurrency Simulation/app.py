from flask import Flask, request, render_template, redirect, url_for, jsonify, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import json
import time
import random
import math
from hashlib import sha256
from uuid import uuid4
from collections import defaultdict, Counter
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-change-this-in-production'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///cryptosim.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# ------------------------
# Database Models
# ------------------------
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    balance = db.Column(db.Float, default=100.0)  # Starting balance
    transactions_sent = db.relationship('UserTransaction', backref='sender', lazy=True, foreign_keys='UserTransaction.sender_id')
    transactions_received = db.relationship('UserTransaction', backref='recipient', lazy=True, foreign_keys='UserTransaction.recipient_id')

class UserTransaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    recipient_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    fee = db.Column(db.Float, default=0.001)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    txid = db.Column(db.String(64), unique=True, nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, confirmed, failed

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# ------------------------
# Network Parameters
# ------------------------
class NetworkParameters:
    def __init__(self):
        self.block_size_limit = 1000000  # 1MB in bytes
        self.mining_difficulty = 3
        self.transaction_fee = 0.001
        self.block_time_target = 10  # seconds
        self.max_transactions_per_block = 1000
        self.network_hashrate = 1000000  # hashes per second
        self.node_count = 10
        self.miner_distribution = {
            'large_miners': 0.3,  # 30% of hashrate
            'medium_miners': 0.4,  # 40% of hashrate
            'small_miners': 0.3   # 30% of hashrate
        }

# ------------------------
# Blockchain Components
# ------------------------
class Block:
    def __init__(self, index, timestamp, transactions, previous_hash, nonce=0, block_size=0):
        self.index = index
        self.timestamp = timestamp
        self.transactions = transactions
        self.previous_hash = previous_hash
        self.nonce = nonce
        self.block_size = block_size
        self.hash = self.compute_hash()

    def compute_hash(self):
        block_string = json.dumps(self.__dict__, sort_keys=True)
        return sha256(block_string.encode()).hexdigest()

class Transaction:
    def __init__(self, sender, recipient, amount, fee=0.001, timestamp=None):
        self.sender = sender
        self.recipient = recipient
        self.amount = float(amount)
        self.fee = float(fee)
        self.timestamp = timestamp or time.time()
        self.txid = self.compute_txid()
        self.size = len(json.dumps(self.__dict__))

    def compute_txid(self):
        tx_string = json.dumps({
            'sender': self.sender,
            'recipient': self.recipient,
            'amount': self.amount,
            'fee': self.fee,
            'timestamp': self.timestamp
        }, sort_keys=True)
        return sha256(tx_string.encode()).hexdigest()

class Blockchain:
    def __init__(self, network_params):
        self.chain = []
        self.current_transactions = []
        self.network_params = network_params
        self.balances = defaultdict(float)
        self.mempool = []
        self.mining_stats = {
            'total_blocks_mined': 0,
            'total_transactions_processed': 0,
            'average_block_time': 0,
            'difficulty_adjustments': 0,
            'orphaned_blocks': 0
        }
        self.decentralization_metrics = {
            'gini_coefficient': 0,
            'herfindahl_index': 0,
            'top_miners_concentration': 0,
            'node_distribution': {}
        }
        self.miner_stats = defaultdict(lambda: {
            'blocks_mined': 0,
            'total_rewards': 0,
            'hashrate': 0
        })
        self.create_genesis_block()

    def create_genesis_block(self):
        genesis_block = Block(0, time.time(), [], "0", block_size=0)
        self.chain.append(genesis_block)

    def get_last_block(self):
        return self.chain[-1]

    def add_transaction(self, sender, recipient, amount, fee=None):
        if fee is None:
            fee = self.network_params.transaction_fee
        
        amount = float(amount)
        fee = float(fee)
        
        if sender != "MINER" and self.balances[sender] < (amount + fee):
            return False, "Insufficient balance"
        
        transaction = Transaction(sender, recipient, amount, fee)
        
        # Check if transaction would fit in a block
        if transaction.size > self.network_params.block_size_limit:
            return False, "Transaction too large"
        
        self.mempool.append(transaction)
        
        if sender != "MINER":
            self.balances[sender] -= (amount + fee)
        self.balances[recipient] += amount
        
        return True, transaction.txid

    def select_transactions_for_block(self):
        """Select transactions from mempool based on fee priority and size limits"""
        sorted_mempool = sorted(self.mempool, key=lambda tx: tx.fee/tx.size, reverse=True)
        
        selected_transactions = []
        current_size = 0
        
        for tx in sorted_mempool:
            if (current_size + tx.size <= self.network_params.block_size_limit and 
                len(selected_transactions) < self.network_params.max_transactions_per_block):
                selected_transactions.append(tx)
                current_size += tx.size
        
        return selected_transactions, current_size

    def proof_of_work(self, block):
        block.nonce = 0
        block.hash = block.compute_hash()
        target = '0' * self.network_params.mining_difficulty
        
        while not block.hash.startswith(target):
            block.nonce += 1
            block.hash = block.compute_hash()
        
        return block.hash

    def mine_block(self, miner):
        if not self.mempool:
            return None, "No transactions to mine"
        
        # Select transactions for this block
        selected_transactions, block_size = self.select_transactions_for_block()
        
        if not selected_transactions:
            return None, "No valid transactions to mine"
        
        # Calculate total fees
        total_fees = sum(tx.fee for tx in selected_transactions)
        
        # Add mining reward transaction
        reward_tx = Transaction("MINER", miner, 10.0 + total_fees, 0)
        selected_transactions.append(reward_tx)
        
        last_block = self.get_last_block()
        new_block = Block(
            index=last_block.index + 1,
            timestamp=time.time(),
            transactions=selected_transactions,
            previous_hash=last_block.hash,
            block_size=block_size
        )
        
        new_block.hash = self.proof_of_work(new_block)
        self.chain.append(new_block)
        
        # Remove mined transactions from mempool
        for tx in selected_transactions[:-1]:  # Exclude reward transaction
            if tx in self.mempool:
                self.mempool.remove(tx)
        
        # Update mining statistics
        self.mining_stats['total_blocks_mined'] += 1
        self.mining_stats['total_transactions_processed'] += len(selected_transactions) - 1
        
        # Update miner statistics
        self.miner_stats[miner]['blocks_mined'] += 1
        self.miner_stats[miner]['total_rewards'] += 10.0 + total_fees
        
        # Calculate decentralization metrics
        self.update_decentralization_metrics()
        
        return new_block, f"Block mined successfully with {len(selected_transactions)-1} transactions"

    def update_decentralization_metrics(self):
        """Calculate various decentralization metrics"""
        if not self.miner_stats:
            return
        
        # Calculate Gini coefficient for mining rewards
        rewards = [stats['total_rewards'] for stats in self.miner_stats.values()]
        if len(rewards) > 1:
            rewards.sort()
            n = len(rewards)
            cumsum = sum(rewards)
            gini_numerator = sum((2 * i - n - 1) * reward for i, reward in enumerate(rewards, 1))
            gini_denominator = n * cumsum
            self.decentralization_metrics['gini_coefficient'] = gini_numerator / gini_denominator if gini_denominator > 0 else 0
        
        # Calculate Herfindahl-Hirschman Index
        total_rewards = sum(rewards)
        if total_rewards > 0:
            market_shares = [reward / total_rewards for reward in rewards]
            self.decentralization_metrics['herfindahl_index'] = sum(share ** 2 for share in market_shares)
        
        # Top miners concentration (percentage controlled by top 3 miners)
        sorted_miners = sorted(self.miner_stats.items(), key=lambda x: x[1]['total_rewards'], reverse=True)
        top_3_rewards = sum(stats['total_rewards'] for _, stats in sorted_miners[:3])
        total_rewards = sum(stats['total_rewards'] for _, stats in self.miner_stats.values())
        self.decentralization_metrics['top_miners_concentration'] = (top_3_rewards / total_rewards * 100) if total_rewards > 0 else 0

    def adjust_difficulty(self):
        """Adjust mining difficulty based on recent block times"""
        if len(self.chain) < 10:
            return
        
        recent_blocks = self.chain[-10:]
        actual_time = recent_blocks[-1].timestamp - recent_blocks[0].timestamp
        target_time = self.network_params.block_time_target * 10
        
        if actual_time < target_time * 0.5:
            self.network_params.mining_difficulty += 1
        elif actual_time > target_time * 2:
            self.network_params.mining_difficulty = max(1, self.network_params.mining_difficulty - 1)
        
        self.mining_stats['difficulty_adjustments'] += 1

    def get_network_analytics(self):
        """Get comprehensive network analytics"""
        return {
            'network_params': {
                'block_size_limit': self.network_params.block_size_limit,
                'mining_difficulty': self.network_params.mining_difficulty,
                'transaction_fee': self.network_params.transaction_fee,
                'block_time_target': self.network_params.block_time_target,
                'max_transactions_per_block': self.network_params.max_transactions_per_block
            },
            'mining_stats': self.mining_stats,
            'decentralization_metrics': self.decentralization_metrics,
            'mempool_size': len(self.mempool),
            'total_blocks': len(self.chain),
            'total_transactions': self.mining_stats['total_transactions_processed'],
            'average_block_size': sum(block.block_size for block in self.chain) / len(self.chain) if self.chain else 0,
            'miner_distribution': dict(self.miner_stats)
        }

    def to_dict(self):
        return [block.__dict__ for block in self.chain]

    def get_transaction_history(self):
        history = []
        for block in self.chain:
            for txn in block.transactions:
                if hasattr(txn, 'txid'):  # Transaction object
                    txn_dict = {
                        'txid': txn.txid,
                        'sender': txn.sender,
                        'recipient': txn.recipient,
                        'amount': txn.amount,
                        'fee': txn.fee,
                        'timestamp': txn.timestamp,
                        'block': block.index
                    }
                else:  # Legacy transaction dict
                    txn_dict = txn.copy()
                    txn_dict['block'] = block.index
                history.append(txn_dict)
        return history

# ------------------------
# App Initialization
# ------------------------
network_params = NetworkParameters()
blockchain = Blockchain(network_params)
blockchain.balances['alice'] = 50
blockchain.balances['bob'] = 30
blockchain.balances['carol'] = 20
node_id = str(uuid4()).replace('-', '')

# ------------------------
# Flask Routes
# ------------------------
@app.route('/')
@login_required
def index():
    # Get user balances from database
    users = User.query.all()
    user_balances = {user.username: user.balance for user in users}
    
    # Update blockchain balances to match database
    blockchain.balances = user_balances
    
    return render_template('index.html', balances=user_balances, user=current_user)

@app.route('/send', methods=['POST'])
@login_required
def send():
    sender = current_user.username
    recipient = request.form['recipient']
    amount = float(request.form['amount'])
    fee = float(request.form.get('fee', network_params.transaction_fee))
    
    # Check if recipient exists
    recipient_user = User.query.filter_by(username=recipient).first()
    if not recipient_user:
        flash('Recipient not found', 'error')
        return redirect(url_for('index'))
    
    # Check if user has enough balance
    if current_user.balance < (amount + fee):
        flash('Insufficient balance', 'error')
        return redirect(url_for('index'))
    
    # Create transaction in database
    txid = sha256(f"{sender}{recipient}{amount}{fee}{time.time()}".encode()).hexdigest()
    user_transaction = UserTransaction(
        sender_id=current_user.id,
        recipient_id=recipient_user.id,
        amount=amount,
        fee=fee,
        txid=txid
    )
    db.session.add(user_transaction)
    
    # Update balances
    current_user.balance -= (amount + fee)
    recipient_user.balance += amount
    
    # Add to blockchain
    success, message = blockchain.add_transaction(sender, recipient, amount, fee)
    if not success:
        db.session.rollback()
        flash('Transaction failed', 'error')
        return redirect(url_for('index'))
    
    db.session.commit()
    flash('Transaction sent successfully!', 'success')
    return redirect(url_for('index'))

@app.route('/mine', methods=['POST'])
@login_required
def miner():
    miner = current_user.username
    new_block, message = blockchain.mine_block(miner)
    if not new_block:
        flash('Mining failed: ' + message, 'error')
        return redirect(url_for('index'))
    
    flash('Block mined successfully!', 'success')
    return redirect(url_for('index'))

@app.route('/chain')
def get_chain():
    return jsonify(blockchain.to_dict())

@app.route('/balances')
def get_balances():
    return jsonify(blockchain.balances)

@app.route('/transactions')
def get_transactions():
    return jsonify(blockchain.get_transaction_history())

@app.route('/analytics')
def get_analytics():
    return jsonify(blockchain.get_network_analytics())

@app.route('/mempool')
def get_mempool():
    return jsonify([{
        'txid': tx.txid,
        'sender': tx.sender,
        'recipient': tx.recipient,
        'amount': tx.amount,
        'fee': tx.fee,
        'size': tx.size
    } for tx in blockchain.mempool])

@app.route('/update_params', methods=['POST'])
def update_network_params():
    data = request.get_json()
    
    if 'block_size_limit' in data:
        blockchain.network_params.block_size_limit = int(data['block_size_limit'])
    if 'mining_difficulty' in data:
        blockchain.network_params.mining_difficulty = int(data['mining_difficulty'])
    if 'transaction_fee' in data:
        blockchain.network_params.transaction_fee = float(data['transaction_fee'])
    if 'block_time_target' in data:
        blockchain.network_params.block_time_target = int(data['block_time_target'])
    if 'max_transactions_per_block' in data:
        blockchain.network_params.max_transactions_per_block = int(data['max_transactions_per_block'])
    
    return jsonify({"message": "Network parameters updated successfully"})

@app.route('/api/send', methods=['POST'])
def api_send():
    data = request.get_json()
    if not all(k in data for k in ('sender', 'recipient', 'amount')):
        return jsonify({"error": "Missing fields"}), 400
    
    fee = data.get('fee', network_params.transaction_fee)
    success, message = blockchain.add_transaction(data['sender'], data['recipient'], data['amount'], fee)
    
    if not success:
        return jsonify({"error": message}), 400
    return jsonify({"message": "Transaction added", "txid": message}), 201

@app.route('/api/mine', methods=['POST'])
def api_mine():
    data = request.get_json()
    if 'miner' not in data:
        return jsonify({"error": "Miner address required"}), 400
    
    block, message = blockchain.mine_block(data['miner'])
    if not block:
        return jsonify({"error": message}), 400
    
    return jsonify(block.__dict__), 201

# ------------------------
# Authentication Routes
# ------------------------
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = User.query.filter_by(username=username).first()
        
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            flash('Logged in successfully!', 'success')
            return redirect(url_for('index'))
        else:
            flash('Invalid username or password', 'error')
    
    return render_template('login.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']
        confirm_password = request.form['confirm_password']
        
        if password != confirm_password:
            flash('Passwords do not match', 'error')
            return render_template('signup.html')
        
        if User.query.filter_by(username=username).first():
            flash('Username already exists', 'error')
            return render_template('signup.html')
        
        if User.query.filter_by(email=email).first():
            flash('Email already registered', 'error')
            return render_template('signup.html')
        
        password_hash = generate_password_hash(password)
        new_user = User(username=username, email=email, password_hash=password_hash)
        db.session.add(new_user)
        db.session.commit()
        
        flash('Account created successfully! Please log in.', 'success')
        return redirect(url_for('login'))
    
    return render_template('signup.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Logged out successfully!', 'success')
    return redirect(url_for('login'))

@app.route('/profile')
@login_required
def profile():
    user_transactions = UserTransaction.query.filter(
        (UserTransaction.sender_id == current_user.id) | 
        (UserTransaction.recipient_id == current_user.id)
    ).order_by(UserTransaction.timestamp.desc()).limit(10).all()
    
    return render_template('profile.html', user=current_user, transactions=user_transactions)

# ------------------------
# Database Initialization
# ------------------------
def init_db():
    with app.app_context():
        db.create_all()
        
        # Create default users if they don't exist
        if not User.query.filter_by(username='alice').first():
            alice = User(
                username='alice',
                email='alice@example.com',
                password_hash=generate_password_hash('password123'),
                balance=50.0
            )
            db.session.add(alice)
        
        if not User.query.filter_by(username='bob').first():
            bob = User(
                username='bob',
                email='bob@example.com',
                password_hash=generate_password_hash('password123'),
                balance=30.0
            )
            db.session.add(bob)
        
        if not User.query.filter_by(username='carol').first():
            carol = User(
                username='carol',
                email='carol@example.com',
                password_hash=generate_password_hash('password123'),
                balance=20.0
            )
            db.session.add(carol)
        
        db.session.commit()

if __name__ == '__main__':
    init_db()
    app.run(debug=True)